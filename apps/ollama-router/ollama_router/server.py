"""HTTP server: an OpenAI-compatible endpoint that picks the model for you.

Built on http.server from the standard library. That is an unusual choice
for a server, and it is deliberate: this daemon is meant to run on any
machine with Python and nothing else installed. ThreadingHTTPServer handles
concurrent requests, which is enough for a local router whose real
bottleneck is the GPU, not the socket layer.

The headline endpoint is POST /v1/chat/completions. Point any OpenAI client
at this server, pass model "auto", and the router picks a local model based
on measured performance. Pass a real model name and it is used directly, so
the router never gets in the way when you already know what you want.
"""

from __future__ import annotations

import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable

from .bench import benchmark, benchmark_all, discover, probe_gpu
from .ollama import OllamaClient, OllamaError, result_from_chunk
from .registry import Registry
from .router import Router

MAX_BODY_BYTES = 8 * 1024 * 1024



class RouterService:
    """Everything the HTTP layer needs, with no HTTP in it.

    Keeping the logic here rather than in the handler means the whole
    service is testable by calling methods directly.
    """

    def __init__(self, client: OllamaClient, registry: Registry,
                 router: Router) -> None:
        self.client = client
        self.registry = registry
        self.router = router

    def resident_models(self) -> list[str]:
        try:
            return [r.name for r in self.client.ps()]
        except OllamaError:
            # Residency is an optimisation. If we cannot read it, route
            # without it rather than failing the request.
            return []

    def decide(self, prompt: str, **kwargs) -> Any:
        kwargs.setdefault("resident", self.resident_models())
        return self.router.route(prompt, **kwargs)

    def chat(self, messages: list[dict[str, str]], *, model: str = "auto",
             objective: str = "balanced", stream: bool = False,
             max_tokens: int = 512, temperature: float | None = None,
             require: list[str] | None = None):
        """Run a chat request, routing when the caller asked for "auto"."""
        prompt = "\n".join(m.get("content", "") for m in messages)
        decision = None
        route_id = None

        if model in ("auto", "", None):
            decision = self.decide(prompt, objective=objective, require=require,
                                   max_output_tokens=max_tokens)
            if not decision.chosen:
                raise OllamaError(decision.reason)
            model = decision.chosen
            route_id = self.registry.record_route(
                chosen=model, intent=decision.intent, objective=objective,
                reason=decision.reason,
                considered=[c.as_dict() for c in decision.considered[:5]],
                predicted_s=decision.predicted_s,
            )
        return model, decision, route_id, prompt

    def record_outcome(self, route_id: int | None, model: str, result,
                       elapsed: float) -> None:
        """Feed a real request's timings back into the registry.

        Every routed request doubles as a benchmark. The router gets more
        accurate the more it is used, without a separate benchmark run.
        """
        if result.tokens_per_second > 0:
            gpu_fraction = -1.0
            try:
                for r in self.client.ps():
                    if r.name == model:
                        gpu_fraction = r.gpu_fraction
                        break
            except OllamaError:
                pass
            self.registry.record_measurement(
                model, "live",
                gen_tps=result.tokens_per_second,
                prefill_tps=result.prefill_tokens_per_second,
                load_s=result.load_s,
                gpu_fraction=gpu_fraction,
                output_tokens=result.output_tokens,
                was_resident=result.load_s < 0.5,
            )
        if route_id is not None:
            self.registry.close_route(route_id, actual_s=elapsed,
                                      output_tokens=result.output_tokens)


def make_handler(service: RouterService) -> type[BaseHTTPRequestHandler]:
    """Build a request handler bound to one service instance."""

    class Handler(BaseHTTPRequestHandler):
        server_version = "OllamaRouter/1.0"
        protocol_version = "HTTP/1.1"

        # -- plumbing ---------------------------------------------------

        def log_message(self, format: str, *args) -> None:  # noqa: A002,A003
            # Quiet by default; the daemon prints its own structured lines.
            pass

        def _send(self, code: int, payload: Any, *, content_type: str = "application/json") -> None:
            body = (json.dumps(payload, indent=2) if content_type == "application/json"
                    else str(payload)).encode()
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        def _error(self, code: int, message: str) -> None:
            self._send(code, {"error": {"message": message, "type": "router_error"}})

        def _read_json(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0:
                return {}
            if length > MAX_BODY_BYTES:
                raise ValueError(f"request body too large: {length} bytes")
            raw = self.rfile.read(length)
            try:
                data = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise ValueError(f"invalid JSON: {exc}") from exc
            if not isinstance(data, dict):
                raise ValueError("request body must be a JSON object")
            return data

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.end_headers()

        # -- routes -----------------------------------------------------

        def do_GET(self) -> None:  # noqa: N802
            path = self.path.split("?", 1)[0].rstrip("/") or "/"
            try:
                if path == "/":
                    self._send(200, {
                        "service": "ollama-router",
                        "endpoints": ["/health", "/models", "/v1/models", "/stats",
                                      "/routes", "/v1/chat/completions", "/route",
                                      "/benchmark", "/discover"],
                    })
                elif path == "/health":
                    self._health()
                elif path in ("/models", "/v1/models"):
                    self._models(openai_shape=path.startswith("/v1"))
                elif path == "/stats":
                    self._stats()
                elif path == "/routes":
                    self._send(200, {"routes": service.registry.recent_routes(50)})
                else:
                    self._error(404, f"no such endpoint: {path}")
            except Exception as exc:  # noqa: BLE001
                self._error(500, f"{type(exc).__name__}: {exc}")

        def do_POST(self) -> None:  # noqa: N802
            path = self.path.split("?", 1)[0].rstrip("/") or "/"
            try:
                body = self._read_json()
            except ValueError as exc:
                self._error(400, str(exc))
                return

            try:
                if path == "/v1/chat/completions":
                    self._chat_completions(body)
                elif path == "/route":
                    self._route_only(body)
                elif path == "/benchmark":
                    self._benchmark(body)
                elif path == "/discover":
                    names = discover(service.client, service.registry)
                    self._send(200, {"discovered": names, "count": len(names)})
                else:
                    self._error(404, f"no such endpoint: {path}")
            except OllamaError as exc:
                self._error(502, str(exc))
            except Exception as exc:  # noqa: BLE001
                self._error(500, f"{type(exc).__name__}: {exc}")

        # -- handlers ---------------------------------------------------

        def _health(self) -> None:
            gpu = probe_gpu()
            try:
                version = service.client.version()
                reachable = True
            except OllamaError as exc:
                version = str(exc)
                reachable = False
            self._send(200 if reachable else 503, {
                "ok": reachable,
                "ollama": {"reachable": reachable, "version": version,
                           "base_url": service.client.base_url},
                "gpu": {"detected": gpu.detected, "name": gpu.name,
                        "total_bytes": gpu.total_bytes, "free_bytes": gpu.free_bytes},
                "models_known": len(service.registry.models()),
                "measurements": service.registry.measurement_count(),
            })

        def _models(self, *, openai_shape: bool) -> None:
            resident = set(service.resident_models())
            rows = []
            for m in service.registry.models():
                perf = service.registry.perf(m["name"])
                rows.append({
                    "id": m["name"],
                    "size_bytes": m["size_bytes"],
                    "family": m["family"],
                    "parameter_size": m["parameter_size"],
                    "quantization": m["quantization"],
                    "capabilities": m["capabilities"],
                    "context_length": m["context_length"],
                    "total_params": m["total_params"],
                    "active_params": m["active_params"],
                    "is_moe": m["expert_count"] > 0,
                    "resident": m["name"] in resident,
                    "measured": perf.measured,
                    "gen_tps": round(perf.gen_tps, 1) if perf.measured else None,
                    "cold_load_s": round(perf.cold_load_s, 1) if perf.cold_load_s else None,
                    "gpu_fraction": perf.gpu_fraction if perf.gpu_fraction >= 0 else None,
                    "samples": perf.samples,
                })
            if openai_shape:
                # Shape expected by OpenAI clients, plus our extra fields,
                # which clients ignore.
                self._send(200, {
                    "object": "list",
                    "data": [{"id": r["id"], "object": "model", "created": 0,
                              "owned_by": "ollama", **r} for r in rows],
                })
            else:
                self._send(200, {"models": rows, "count": len(rows)})

        def _stats(self) -> None:
            gpu = probe_gpu()
            self._send(200, {
                "models": len(service.registry.models()),
                "measurements": service.registry.measurement_count(),
                "prediction_accuracy": service.registry.prediction_accuracy(),
                "resident": service.resident_models(),
                "vram_total_bytes": gpu.total_bytes,
                "vram_free_bytes": gpu.free_bytes,
                "vram_budget_bytes": service.router.vram_budget,
            })

        def _route_only(self, body: dict[str, Any]) -> None:
            """Explain a routing decision without running the model.

            The whole point of a router is that you can audit it, so this
            returns the full scoring breakdown including rejected models.
            """
            prompt = body.get("prompt")
            if not prompt and body.get("messages"):
                prompt = "\n".join(m.get("content", "") for m in body["messages"])
            if not prompt:
                self._error(400, "provide either 'prompt' or 'messages'")
                return
            decision = service.decide(
                prompt,
                objective=body.get("objective", "balanced"),
                require=body.get("require"),
                exclude=body.get("exclude"),
                max_output_tokens=int(body.get("max_tokens", 512)),
            )
            self._send(200, decision.as_dict())

        def _benchmark(self, body: dict[str, Any]) -> None:
            model = body.get("model")
            tokens = int(body.get("tokens", 48))
            if model and model != "all":
                self._send(200, benchmark(service.client, service.registry,
                                          model, tokens=tokens))
            else:
                results = benchmark_all(service.client, service.registry,
                                        tokens=tokens,
                                        skip_oversized=body.get("skip_oversized", True))
                self._send(200, {"results": results, "count": len(results)})

        def _chat_completions(self, body: dict[str, Any]) -> None:
            messages = body.get("messages") or []
            if not messages:
                self._error(400, "'messages' is required and must not be empty")
                return

            requested = body.get("model", "auto")
            stream = bool(body.get("stream"))
            max_tokens = int(body.get("max_tokens") or 512)

            # Objective may come from the body or from a header. The header
            # exists because OpenAI client libraries expose custom headers
            # but not custom body fields, so it is the only way an off the
            # shelf SDK can ask for a different tradeoff.
            objective = (body.get("objective")
                         or self.headers.get("X-Router-Objective")
                         or "balanced")

            try:
                model, decision, route_id, _ = service.chat(
                    messages, model=requested,
                    objective=objective,
                    max_tokens=max_tokens,
                    require=body.get("require"),
                )
            except OllamaError as exc:
                self._error(503, str(exc))
                return
            except ValueError as exc:
                # Unknown objective or other bad request value.
                self._error(400, str(exc))
                return

            # A reasoning model spends tokens thinking before it writes a
            # single word of the answer, and Ollama counts both against
            # num_predict. Passing a small max_tokens straight through means
            # the budget is gone before the answer starts and the caller gets
            # an empty string. Give thinking models room for both, while
            # still honouring the caller's intent for the visible answer.
            num_predict = max_tokens
            if "thinking" in (service.registry.model(model) or {}).get("capabilities", ""):
                num_predict = max(max_tokens * 4, max_tokens + 512)

            options: dict[str, Any] = {"num_predict": num_predict}
            if num_predict != max_tokens and decision and route_id:
                # The route was scored against the caller's max_tokens, but we
                # are about to generate against a wider budget. Leaving the
                # original figure recorded would make the router look badly
                # miscalibrated when it was measuring a different question.
                decision.predicted_s = decision.predict_seconds(num_predict)
                service.registry.update_prediction(route_id, decision.predicted_s)
            if body.get("temperature") is not None:
                options["temperature"] = body["temperature"]

            started = time.time()
            if stream:
                self._stream_chat(model, messages, options, decision, route_id, started)
            else:
                result = service.client.chat(model, messages, options=options)
                elapsed = time.time() - started
                service.record_outcome(route_id, model, result, elapsed)
                payload = {
                    "id": f"chatcmpl-{route_id or int(started)}",
                    "object": "chat.completion",
                    "created": int(started),
                    "model": model,
                    "choices": [{
                        "index": 0,
                        "message": {"role": "assistant", "content": result.text},
                        "finish_reason": "stop",
                    }],
                    "usage": {
                        "prompt_tokens": result.prompt_tokens,
                        "completion_tokens": result.output_tokens,
                        "total_tokens": result.prompt_tokens + result.output_tokens,
                    },
                }
                if decision is not None:
                    # Non-standard, and that is the point: the caller can see
                    # why this model was picked without a second request.
                    payload["x_router"] = {
                        "intent": decision.intent,
                        "objective": decision.objective,
                        "reason": decision.reason,
                        "predicted_s": round(decision.predicted_s, 2),
                        "actual_s": round(elapsed, 2),
                        "runners_up": [c.name for c in decision.considered[1:4]],
                    }
                self._send(200, payload)

        def _stream_chat(self, model: str, messages: list[dict[str, str]],
                         options: dict[str, Any], decision, route_id, started: float) -> None:
            """Server-sent events in the OpenAI streaming format."""
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            chat_id = f"chatcmpl-{route_id or int(started)}"

            def emit(obj: dict[str, Any]) -> None:
                self.wfile.write(f"data: {json.dumps(obj)}\n\n".encode())
                self.wfile.flush()

            if decision is not None:
                emit({"id": chat_id, "object": "chat.completion.chunk",
                      "model": model, "x_router": {"reason": decision.reason,
                                                   "intent": decision.intent}})
            try:
                final: dict[str, Any] | None = None
                for chunk in service.client.chat_stream(model, messages, options=options):
                    # chat_stream yields raw Ollama objects. The last one
                    # carries the timings and has no content to emit.
                    if chunk.get("done"):
                        final = chunk
                        break
                    piece = (chunk.get("message") or {}).get("content", "")
                    if not piece:
                        continue
                    emit({
                        "id": chat_id, "object": "chat.completion.chunk",
                        "created": int(started), "model": model,
                        "choices": [{"index": 0, "delta": {"content": piece},
                                     "finish_reason": None}],
                    })
                emit({
                    "id": chat_id, "object": "chat.completion.chunk",
                    "created": int(started), "model": model,
                    "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                })
                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
                if final is not None:
                    service.record_outcome(
                        route_id, model, result_from_chunk(model, final),
                        time.time() - started)
            except (OllamaError, BrokenPipeError, ConnectionResetError):
                # The client hung up or Ollama failed mid-stream. Headers are
                # already sent, so there is no way to turn this into a clean
                # HTTP error; just stop.
                return

    return Handler


def serve(host: str = "127.0.0.1", port: int = 11435, *,
          ollama_url: str = "http://localhost:11434",
          db_path: str = "router.db",
          on_ready: Callable[[str], None] | None = None) -> None:
    client = OllamaClient(ollama_url)
    registry = Registry(db_path)
    gpu = probe_gpu()
    router = Router(registry, vram_bytes=gpu.total_bytes)
    service = RouterService(client, registry, router)

    # Populate on boot so the first request does not pay discovery cost.
    try:
        found = discover(client, registry)
        print(f"discovered {len(found)} models from {ollama_url}")
    except OllamaError as exc:
        print(f"warning: could not reach Ollama at {ollama_url}: {exc}")
        print("the server will start anyway; /health will report it as down")

    if gpu.detected:
        print(f"gpu: {gpu.name}, {gpu.total_bytes / 1e9:.1f}GB total, "
              f"routing budget {router.vram_budget / 1e9:.1f}GB")
    else:
        print("gpu: not detected, VRAM fit checks disabled")

    httpd = ThreadingHTTPServer((host, port), make_handler(service))
    url = f"http://{host}:{port}"
    print(f"ollama-router listening on {url}")
    if on_ready:
        on_ready(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")
    finally:
        httpd.server_close()
        registry.close()
