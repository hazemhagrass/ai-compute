"""Thin Ollama HTTP client built on the standard library.

No third-party dependencies on purpose: this daemon should run on a fresh
machine with nothing but Python installed, because the whole point is to sit
in front of a local Ollama that someone just installed.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Iterator


class OllamaError(RuntimeError):
    """Ollama returned a non-2xx response or could not be reached."""

    def __init__(self, message: str, *, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class OllamaUnreachable(OllamaError):
    """The Ollama daemon is not listening. Distinct so callers can tell the
    user to start it rather than reporting a generic failure."""


@dataclass(frozen=True)
class GenerateResult:
    """One non-streaming generation, with the timings Ollama reports.

    Durations arrive in nanoseconds; they are converted once here so no
    caller has to remember the unit.
    """

    text: str
    model: str
    prompt_tokens: int
    output_tokens: int
    load_s: float
    prompt_eval_s: float
    eval_s: float
    total_s: float

    @property
    def tokens_per_second(self) -> float:
        """Generation throughput, excluding load and prefill.

        Returns 0.0 rather than dividing by zero when a model emits nothing,
        which happens when num_predict is 0 or the model immediately stops.
        """
        if self.eval_s <= 0 or self.output_tokens <= 0:
            return 0.0
        return self.output_tokens / self.eval_s

    @property
    def prefill_tokens_per_second(self) -> float:
        if self.prompt_eval_s <= 0 or self.prompt_tokens <= 0:
            return 0.0
        return self.prompt_tokens / self.prompt_eval_s


@dataclass(frozen=True)
class ResidentModel:
    """A model currently held in memory, from /api/ps."""

    name: str
    size_bytes: int
    vram_bytes: int
    expires_at: str | None = None

    @property
    def gpu_fraction(self) -> float:
        """Share of the model sitting in VRAM.

        Below 1.0 means Ollama split the model between GPU and CPU. That
        split is the single largest predictor of slow generation, so it is
        surfaced as a first-class number rather than left for callers to
        derive.
        """
        if self.size_bytes <= 0:
            return 0.0
        return min(1.0, self.vram_bytes / self.size_bytes)


@dataclass(frozen=True)
class ModelCard:
    """Static facts about an installed model, from /api/tags + /api/show."""

    name: str
    size_bytes: int
    family: str = ""
    parameter_size: str = ""
    quantization: str = ""
    capabilities: tuple[str, ...] = ()
    context_length: int = 0
    total_params: int = 0
    active_params: int = 0
    expert_count: int = 0
    expert_used: int = 0
    model_info: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def is_moe(self) -> bool:
        return self.expert_count > 0

    @property
    def size_gb(self) -> float:
        return self.size_bytes / 1e9


def _ns_to_s(value: Any) -> float:
    try:
        return float(value) / 1e9
    except (TypeError, ValueError):
        return 0.0


class OllamaClient:
    """Synchronous Ollama client.

    One instance is safe to share across threads: it holds no mutable state
    and urllib opens a fresh connection per call.
    """

    def __init__(self, base_url: str = "http://localhost:11434", timeout: float = 600.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    # ---- plumbing ----------------------------------------------------

    def _request(self, path: str, payload: dict[str, Any] | None = None,
                 *, method: str = "POST", timeout: float | None = None) -> Any:
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(
            url, data=data, method=method,
            headers={"Content-Type": "application/json"} if data else {},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout or self.timeout) as resp:
                body = resp.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:400]
            raise OllamaError(f"{method} {path} failed: {exc.code} {detail}", status=exc.code) from exc
        except urllib.error.URLError as exc:
            raise OllamaUnreachable(
                f"cannot reach Ollama at {self.base_url}: {exc.reason}. "
                f"Is it running? Try: ollama serve"
            ) from exc
        if not body:
            return None
        return json.loads(body)

    # ---- introspection -----------------------------------------------

    def version(self) -> str:
        data = self._request("/api/version", method="GET", timeout=10)
        return (data or {}).get("version", "unknown")

    def is_up(self) -> bool:
        try:
            self.version()
            return True
        except OllamaError:
            return False

    def list_models(self) -> list[dict[str, Any]]:
        data = self._request("/api/tags", method="GET", timeout=30)
        return (data or {}).get("models", [])

    def show(self, model: str) -> dict[str, Any]:
        return self._request("/api/show", {"model": model}, timeout=60) or {}

    def ps(self) -> list[ResidentModel]:
        """Models currently loaded in memory.

        Returns an empty list when Ollama is unreachable rather than raising:
        residency is an optimisation input, and losing it should degrade
        routing quality, never break the request.
        """
        try:
            data = self._request("/api/ps", method="GET", timeout=10)
        except OllamaError:
            return []
        out = []
        for m in (data or {}).get("models", []):
            out.append(ResidentModel(
                name=m.get("name") or m.get("model", ""),
                size_bytes=int(m.get("size", 0)),
                vram_bytes=int(m.get("size_vram", 0)),
                expires_at=m.get("expires_at"),
            ))
        return out

    def card(self, name: str, size_bytes: int = 0) -> ModelCard:
        """Build a ModelCard by combining /api/tags size with /api/show detail."""
        info = self.show(name)
        details = info.get("details", {}) or {}
        mi = info.get("model_info", {}) or {}
        arch = mi.get("general.architecture", "") or details.get("family", "")

        def arch_key(suffix: str) -> Any:
            return mi.get(f"{arch}.{suffix}") if arch else None

        total = int(mi.get("general.parameter_count", 0) or 0)
        experts = int(arch_key("expert_count") or 0)
        used = int(arch_key("expert_used_count") or 0)

        return ModelCard(
            name=name,
            size_bytes=size_bytes,
            family=details.get("family", ""),
            parameter_size=details.get("parameter_size", ""),
            quantization=details.get("quantization_level", ""),
            capabilities=tuple(info.get("capabilities", []) or []),
            context_length=int(arch_key("context_length") or 0),
            total_params=total,
            active_params=_estimate_active_params(total, experts, used),
            expert_count=experts,
            expert_used=used,
            model_info=mi,
        )

    # ---- generation ---------------------------------------------------

    def generate(self, model: str, prompt: str, *, num_predict: int = 128,
                 options: dict[str, Any] | None = None,
                 keep_alive: str | None = None) -> GenerateResult:
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"num_predict": num_predict, **(options or {})},
        }
        if keep_alive is not None:
            payload["keep_alive"] = keep_alive
        started = time.monotonic()
        data = self._request("/api/generate", payload) or {}
        wall = time.monotonic() - started
        return GenerateResult(
            text=data.get("response", ""),
            model=model,
            prompt_tokens=int(data.get("prompt_eval_count", 0)),
            output_tokens=int(data.get("eval_count", 0)),
            load_s=_ns_to_s(data.get("load_duration")),
            prompt_eval_s=_ns_to_s(data.get("prompt_eval_duration")),
            eval_s=_ns_to_s(data.get("eval_duration")),
            total_s=_ns_to_s(data.get("total_duration")) or wall,
        )

    def chat(self, model: str, messages: list[dict[str, Any]], *,
             options: dict[str, Any] | None = None,
             tools: list[dict[str, Any]] | None = None,
             keep_alive: str | None = None) -> GenerateResult:
        """Run a chat request to completion and return it with its timings.

        Ollama returns timings only on the final object, so this collects
        the whole response rather than streaming it.
        """
        payload: dict[str, Any] = {"model": model, "messages": messages, "stream": False}
        if options:
            payload["options"] = options
        if tools:
            payload["tools"] = tools
        if keep_alive is not None:
            payload["keep_alive"] = keep_alive

        data = self._request("/api/chat", payload) or {}
        message = data.get("message") or {}
        # Reasoning models put chain-of-thought in a separate `thinking`
        # field and leave `content` empty when the token budget runs out
        # mid-thought. Falling back to the thinking text is better than
        # returning an empty string that looks like a silent failure.
        text = message.get("content") or ""
        if not text.strip():
            text = message.get("thinking") or ""
        return GenerateResult(
            model=model,
            text=text,
            total_s=_ns_to_s(data.get("total_duration")),
            load_s=_ns_to_s(data.get("load_duration")),
            prompt_eval_s=_ns_to_s(data.get("prompt_eval_duration")),
            eval_s=_ns_to_s(data.get("eval_duration")),
            prompt_tokens=int(data.get("prompt_eval_count") or 0),
            output_tokens=int(data.get("eval_count") or 0),
        )

    def chat_stream(self, model: str, messages: list[dict[str, Any]], *,
                    options: dict[str, Any] | None = None,
                    tools: list[dict[str, Any]] | None = None,
                    keep_alive: str | None = None) -> Iterator[dict[str, Any]]:
        """Yield raw Ollama chat chunks.

        The final chunk carries the timing fields, so callers that want to
        record a measurement should keep the last chunk they see.
        """
        payload: dict[str, Any] = {"model": model, "messages": messages, "stream": True}
        if options:
            payload["options"] = options
        if tools:
            payload["tools"] = tools
        if keep_alive is not None:
            payload["keep_alive"] = keep_alive

        req = urllib.request.Request(
            f"{self.base_url}/api/chat",
            data=json.dumps(payload).encode(),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                for raw in resp:
                    line = raw.strip()
                    if not line:
                        continue
                    try:
                        yield json.loads(line)
                    except json.JSONDecodeError:
                        continue
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:400]
            raise OllamaError(f"chat failed: {exc.code} {detail}", status=exc.code) from exc
        except urllib.error.URLError as exc:
            raise OllamaUnreachable(f"cannot reach Ollama at {self.base_url}: {exc.reason}") from exc

    def embed(self, model: str, text: str) -> list[float]:
        data = self._request("/api/embed", {"model": model, "input": text}) or {}
        vectors = data.get("embeddings") or []
        return vectors[0] if vectors else []

    def unload(self, model: str) -> None:
        """Evict a model by requesting a zero keep-alive."""
        try:
            self._request("/api/generate", {"model": model, "keep_alive": 0, "prompt": ""}, timeout=30)
        except OllamaError:
            pass


def _estimate_active_params(total: int, expert_count: int, expert_used: int) -> int:
    """Parameters actually multiplied per token.

    For a dense model that is the whole network. For a mixture of experts
    only a few experts fire per token, which is why a 30B MoE can generate
    faster than a 14B dense model despite being larger. Routing on total
    parameter count gets that backwards, so active count is tracked
    separately.

    The estimate is deliberately crude: attention and shared layers run for
    every token regardless of routing, so a flat expert ratio understates
    the active share. It is used only to rank models, never reported as a
    measured fact.
    """
    if total <= 0:
        return 0
    if expert_count <= 0 or expert_used <= 0 or expert_used >= expert_count:
        return total
    ratio = expert_used / expert_count
    # Assume roughly a third of parameters are non-expert (attention,
    # embeddings, shared MLP) and always active.
    dense_share = 0.33
    return int(total * (dense_share + (1 - dense_share) * ratio))


def result_from_chunk(model: str, chunk: dict[str, Any]) -> GenerateResult:
    """Rebuild a GenerateResult from the final streaming chunk.

    Streaming and non-streaming requests should both feed the registry, so
    the timings on the terminal chunk are converted into the same shape the
    non-streaming path produces.
    """
    return GenerateResult(
        model=model,
        text="",
        total_s=_ns_to_s(chunk.get("total_duration")),
        load_s=_ns_to_s(chunk.get("load_duration")),
        prompt_eval_s=_ns_to_s(chunk.get("prompt_eval_duration")),
        eval_s=_ns_to_s(chunk.get("eval_duration")),
        prompt_tokens=int(chunk.get("prompt_eval_count") or 0),
        output_tokens=int(chunk.get("eval_count") or 0),
    )
