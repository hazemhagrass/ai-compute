"""Measuring what models actually do on this machine.

Every number the router relies on comes from here. Nothing is copied from a
model card or a leaderboard, because the thing that matters (does this model
fit in this GPU, and how fast does it run when it does not) is a property of
the machine, not of the model.
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass

from .ollama import OllamaClient, OllamaError
from .registry import Registry

# Short, cheap prompts. The goal is to measure throughput, not to evaluate
# answer quality, so the prompt just has to produce a predictable stream of
# tokens without a long think phase.
BENCH_PROMPT = "Count from one to twenty in words, separated by commas."
BENCH_TOKENS = 48


@dataclass(frozen=True)
class GpuInfo:
    total_bytes: int = 0
    used_bytes: int = 0
    name: str = ""

    @property
    def free_bytes(self) -> int:
        return max(0, self.total_bytes - self.used_bytes)

    @property
    def detected(self) -> bool:
        return self.total_bytes > 0


def probe_gpu() -> GpuInfo:
    """Read GPU memory via nvidia-smi.

    Returns an empty GpuInfo when there is no NVIDIA GPU or the tool is
    missing. Callers must treat that as "unknown", never as "no VRAM": on a
    Mac or an AMD box the models still run, we just cannot predict spill.
    """
    exe = shutil.which("nvidia-smi")
    if not exe:
        return GpuInfo()
    try:
        out = subprocess.run(
            [exe, "--query-gpu=name,memory.total,memory.used",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10, check=True).stdout
    except (subprocess.SubprocessError, OSError):
        return GpuInfo()

    line = out.strip().splitlines()[0] if out.strip() else ""
    parts = [p.strip() for p in line.split(",")]
    if len(parts) < 3:
        return GpuInfo()
    try:
        # nvidia-smi reports MiB.
        return GpuInfo(
            name=parts[0],
            total_bytes=int(float(parts[1]) * 1024 * 1024),
            used_bytes=int(float(parts[2]) * 1024 * 1024),
        )
    except ValueError:
        return GpuInfo()


def discover(client: OllamaClient, registry: Registry) -> list[str]:
    """Refresh the registry from whatever Ollama currently has installed.

    Models that disappeared are dropped, so a stale entry cannot be routed
    to and produce a confusing 404 at generation time.
    """
    installed = client.list_models()
    names = []
    for entry in installed:
        name = entry.get("name") or entry.get("model", "")
        if not name:
            continue
        card = client.card(name, size_bytes=int(entry.get("size", 0)))
        registry.upsert_model(card)
        names.append(name)
    registry.forget_missing(names)
    return names


def benchmark(client: OllamaClient, registry: Registry, model: str,
              *, tokens: int = BENCH_TOKENS, keep_loaded: bool = False) -> dict:
    """Run one model and record what happened.

    Captures residency immediately after generating, while the model is
    still loaded, because /api/ps only reports models currently in memory
    and the GPU split is the number we most want.
    """
    # Embedding models reject /api/generate outright. Skip them here rather
    # than recording a failure, because there is nothing wrong with them:
    # they simply do not generate text and the router never sends them a
    # generation request.
    card = registry.model(model)
    if card and "completion" not in card["capabilities"]:
        return {
            "model": model, "ok": False, "skipped": True,
            "error": "not a generative model, nothing to benchmark",
        }

    resident_before = {r.name for r in client.ps()}
    was_resident = model in resident_before

    try:
        result = client.generate(
            model, BENCH_PROMPT, num_predict=tokens,
            keep_alive=None if keep_loaded else "30s",
        )
    except OllamaError as exc:
        return {"model": model, "ok": False, "error": str(exc)}

    gpu_fraction = -1.0
    for r in client.ps():
        if r.name == model:
            gpu_fraction = r.gpu_fraction
            break

    registry.record_measurement(
        model, "benchmark",
        gen_tps=result.tokens_per_second,
        prefill_tps=result.prefill_tokens_per_second,
        load_s=result.load_s,
        gpu_fraction=gpu_fraction,
        output_tokens=result.output_tokens,
        was_resident=was_resident,
    )

    return {
        "model": model,
        "ok": True,
        "gen_tps": round(result.tokens_per_second, 1),
        "prefill_tps": round(result.prefill_tokens_per_second, 1),
        "load_s": round(result.load_s, 2),
        "gpu_fraction": round(gpu_fraction, 3) if gpu_fraction >= 0 else None,
        "output_tokens": result.output_tokens,
        "was_resident": was_resident,
    }


def benchmark_all(client: OllamaClient, registry: Registry, *,
                  models: list[str] | None = None,
                  tokens: int = BENCH_TOKENS,
                  skip_oversized: bool = True,
                  progress=None) -> list[dict]:
    """Benchmark every installed model, smallest first.

    Smallest first matters: a large model can hold VRAM long enough to
    distort the next model's measurement, and going up in size means each
    run starts from the cleanest state available.

    skip_oversized avoids loading models far larger than total VRAM. Those
    runs can take many minutes at single-digit tokens per second, and the
    router can already predict they will spill.
    """
    gpu = probe_gpu()
    rows = registry.models()
    if models:
        wanted = set(models)
        rows = [r for r in rows if r["name"] in wanted]
    rows.sort(key=lambda r: r["size_bytes"])

    out = []
    for row in rows:
        name = row["name"]
        if skip_oversized and gpu.detected and row["size_bytes"] > gpu.total_bytes * 1.5:
            record = {
                "model": name, "ok": False,
                "error": f"skipped: {row['size_bytes']/1e9:.1f}GB far exceeds "
                         f"{gpu.total_bytes/1e9:.1f}GB VRAM, would run on CPU",
                "skipped": True,
            }
            out.append(record)
            if progress:
                progress(record)
            continue
        record = benchmark(client, registry, name, tokens=tokens)
        out.append(record)
        if progress:
            progress(record)
    return out
