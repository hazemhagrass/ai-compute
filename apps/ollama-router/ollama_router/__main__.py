"""Command line entry point: python3 -m ollama_router <command>

Commands:
  serve       run the routing server
  discover    refresh the model registry from Ollama
  bench       measure models and store the results
  models      list what is installed, with measured performance
  route       explain which model would be picked for a prompt, without running it
  ask         route a prompt and stream the answer
"""

from __future__ import annotations

import argparse
import json
import time
import os
import sys

from .bench import benchmark, benchmark_all, discover, probe_gpu
from .ollama import OllamaClient, OllamaError, result_from_chunk
from .registry import Registry
from .router import Router
from .server import RouterService, serve

DEFAULT_DB = os.environ.get("OLLAMA_ROUTER_DB", "router.db")
DEFAULT_OLLAMA = os.environ.get("OLLAMA_HOST", "http://localhost:11434")


def _human_size(n: int) -> str:
    return f"{n / 1e9:.1f}GB" if n else "?"


def _build(db: str, ollama: str) -> tuple[OllamaClient, Registry, Router]:
    client = OllamaClient(ollama)
    registry = Registry(db)
    gpu = probe_gpu()
    return client, registry, Router(registry, vram_bytes=gpu.total_bytes)


def cmd_serve(args) -> int:
    serve(args.host, args.port, ollama_url=args.ollama, db_path=args.db)
    return 0


def cmd_discover(args) -> int:
    client, registry, _ = _build(args.db, args.ollama)
    try:
        names = discover(client, registry)
    except OllamaError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"discovered {len(names)} models:")
    for n in names:
        print(f"  {n}")
    return 0


def cmd_models(args) -> int:
    client, registry, router = _build(args.db, args.ollama)
    rows = registry.models()
    if not rows:
        print("no models known yet, run: python3 -m ollama_router discover")
        return 1
    try:
        resident = {r.name for r in client.ps()}
    except OllamaError:
        resident = set()

    gpu = probe_gpu()
    if gpu.detected:
        print(f"gpu: {gpu.name}  {_human_size(gpu.total_bytes)} total, "
              f"budget {_human_size(router.vram_budget)}\n")

    print(f"{'MODEL':34} {'SIZE':>7} {'TOK/S':>8} {'LOAD':>7} {'GPU':>5}  NOTES")
    print("-" * 82)
    for m in sorted(rows, key=lambda r: r["size_bytes"]):
        perf = registry.perf(m["name"])
        tps = f"{perf.gen_tps:.1f}" if perf.measured else "-"
        load = f"{perf.cold_load_s:.0f}s" if perf.cold_load_s else "-"
        gpu_pct = f"{perf.gpu_fraction:.0%}" if perf.gpu_fraction >= 0 else "-"
        notes = []
        if m["name"] in resident:
            notes.append("resident")
        if m["expert_count"]:
            notes.append(f"MoE {m['expert_used']}/{m['expert_count']}")
        if not perf.measured:
            notes.append("unmeasured")
        if 0 <= perf.gpu_fraction < 0.99:
            notes.append("spills to CPU")
        print(f"{m['name']:34} {_human_size(m['size_bytes']):>7} {tps:>8} "
              f"{load:>7} {gpu_pct:>5}  {', '.join(notes)}")
    return 0


def cmd_bench(args) -> int:
    client, registry, _ = _build(args.db, args.ollama)
    if not registry.models():
        discover(client, registry)

    def show(rec: dict) -> None:
        if rec.get("ok"):
            print(f"  {rec['model']:34} {rec['gen_tps']:>7.1f} tok/s  "
                  f"load {rec['load_s']:.1f}s  gpu "
                  f"{rec['gpu_fraction'] if rec['gpu_fraction'] is not None else '?'}")
        else:
            print(f"  {rec['model']:34} {rec['error']}")

    if args.model and args.model != "all":
        show(benchmark(client, registry, args.model, tokens=args.tokens))
    else:
        print("benchmarking smallest first so a large model cannot distort the next run\n")
        benchmark_all(client, registry, tokens=args.tokens,
                      skip_oversized=not args.include_oversized, progress=show)
    return 0


def cmd_route(args) -> int:
    client, registry, router = _build(args.db, args.ollama)
    service = RouterService(client, registry, router)
    decision = service.decide(args.prompt, objective=args.objective,
                              max_output_tokens=args.max_tokens)
    if args.json:
        print(json.dumps(decision.as_dict(), indent=2))
        return 0 if decision.chosen else 1

    if not decision.chosen:
        print(f"no model chosen: {decision.reason}")
        return 1
    print(f"chosen:    {decision.chosen}")
    print(f"intent:    {decision.intent}")
    print(f"objective: {decision.objective}")
    print(f"reason:    {decision.reason}")
    print(f"predicted: {decision.predicted_s:.1f}s for {args.max_tokens} tokens\n")
    print(f"{'RANK':<5} {'MODEL':34} {'SCORE':>6} {'TOK/S':>8}  NOTES")
    for i, c in enumerate(decision.considered[:6], 1):
        print(f"{i:<5} {c.name:34} {c.score:>6.3f} {c.gen_tps:>8.1f}  "
              f"{'; '.join(c.notes)}")
    if decision.excluded:
        print("\nexcluded:")
        for e in decision.excluded:
            print(f"  {e['model']:34} {e['why']}")
    return 0


def cmd_history(args) -> int:
    _, registry, _ = _build(args.db, args.ollama)
    routes = registry.recent_routes(limit=args.limit)
    if not routes:
        print("no routing history yet; run `ask` or send a request to `serve`")
        return 0

    print(f"{'WHEN':<9} {'MODEL':<32} {'OBJECTIVE':<12} {'PRED':>7} {'ACTUAL':>8} {'TOKENS':>7}")
    print("-" * 82)
    for r in routes:
        when = time.strftime("%H:%M:%S", time.localtime(r["created_at"]))
        actual = f"{r['actual_s']:.1f}s" if r["actual_s"] else "-"
        tokens = str(r["output_tokens"]) if r["output_tokens"] else "-"
        print(f"{when:<9} {r['chosen']:<32} {r['objective']:<12} "
              f"{r['predicted_s']:>6.1f}s {actual:>8} {tokens:>7}")

    acc = registry.prediction_accuracy()
    if acc["samples"]:
        # The router predicts how long each request will take. If those
        # predictions are badly wrong the scoring model is wrong too, so
        # surfacing the error is the honest self-check rather than a stat.
        print(f"\nprediction accuracy over {acc['samples']} closed routes: "
              f"median error {acc['median_relative_error'] * 100:.0f}%, "
              f"{acc['within_50pct'] * 100:.0f}% within 50%")
    return 0


def cmd_ask(args) -> int:
    client, registry, router = _build(args.db, args.ollama)
    service = RouterService(client, registry, router)
    messages = [{"role": "user", "content": args.prompt}]
    try:
        model, decision, route_id, _ = service.chat(
            messages, model=args.model, objective=args.objective,
            max_tokens=args.max_tokens)
    except OllamaError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if decision is not None and not args.quiet:
        print(f"[{model}] {decision.reason}\n", file=sys.stderr)

    import time
    started = time.time()
    try:
        final = None
        for chunk in client.chat_stream(model, messages,
                                        options={"num_predict": args.max_tokens}):
            if chunk.get("done"):
                final = chunk
                break
            piece = (chunk.get("message") or {}).get("content", "")
            if piece:
                sys.stdout.write(piece)
                sys.stdout.flush()
        print()
        if final and not args.quiet:
            result = result_from_chunk(model, final)
            service.record_outcome(route_id, model, result, time.time() - started)
            print(f"\n[{result.output_tokens} tokens at "
                  f"{result.tokens_per_second:.1f} tok/s]", file=sys.stderr)
    except OllamaError as exc:
        print(f"\nerror: {exc}", file=sys.stderr)
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="ollama_router",
        description="Route prompts to local Ollama models by measured performance.")
    parser.add_argument("--db", default=DEFAULT_DB, help=f"registry path (default {DEFAULT_DB})")
    parser.add_argument("--ollama", default=DEFAULT_OLLAMA,
                        help=f"Ollama base URL (default {DEFAULT_OLLAMA})")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("serve", help="run the routing server")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=11435)
    p.set_defaults(func=cmd_serve)

    p = sub.add_parser("discover", help="refresh the registry from Ollama")
    p.set_defaults(func=cmd_discover)

    p = sub.add_parser("models", help="list models with measured performance")
    p.set_defaults(func=cmd_models)

    p = sub.add_parser("bench", help="measure model performance")
    p.add_argument("model", nargs="?", default="all")
    p.add_argument("--tokens", type=int, default=48)
    p.add_argument("--include-oversized", action="store_true",
                   help="also benchmark models far larger than VRAM (slow)")
    p.set_defaults(func=cmd_bench)

    p = sub.add_parser("route", help="explain a routing decision without running it")
    p.add_argument("prompt")
    p.add_argument("--objective", default="balanced",
                   choices=["interactive", "quality", "batch", "balanced"])
    p.add_argument("--max-tokens", type=int, default=512)
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_route)

    p = sub.add_parser("history", help="recent routing decisions and prediction accuracy")
    p.add_argument("--limit", type=int, default=20)
    p.set_defaults(func=cmd_history)

    p = sub.add_parser("ask", help="route a prompt and stream the answer")
    p.add_argument("prompt")
    p.add_argument("--model", default="auto")
    p.add_argument("--objective", default="balanced",
                   choices=["interactive", "quality", "batch", "balanced"])
    p.add_argument("--max-tokens", type=int, default=512)
    p.add_argument("--quiet", action="store_true", help="answer only, no routing notes")
    p.set_defaults(func=cmd_ask)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
