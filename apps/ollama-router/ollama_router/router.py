"""Choosing which local model should answer a prompt.

The routing model here is deliberately different from a cloud router. With a
hosted API you optimise cost per token. Locally, tokens are free and the
scarce resources are VRAM and wall-clock time, so this router optimises:

  1. Will the model fit in VRAM, or will it spill to CPU and crawl?
  2. Is it already resident, or do we pay a cold load first?
  3. How fast does it actually generate, measured rather than guessed?
  4. Can it do the job at all (tools, vision, embedding, context length)?

Two findings from benchmarking drive the design, and both contradict the
obvious heuristic that smaller is faster:

  - A 30B mixture-of-experts model generated at 26.5 tok/s while a 14B dense
    model managed 7.8 tok/s on the same machine. Parameter count alone
    predicts the wrong winner, so active parameters are tracked separately.
  - Cold loading cost between 5 and 55 seconds. For a short prompt that
    dominates everything else, so residency is weighted heavily and a
    resident model often beats a nominally faster one.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .registry import Perf, Registry

# ---------------------------------------------------------------------
# Intent detection
# ---------------------------------------------------------------------

Intent = str

INTENT_PATTERNS: list[tuple[Intent, re.Pattern[str]]] = [
    ("embedding", re.compile(r"\b(embed|embedding|vector|similarity search)\b", re.I)),
    ("code", re.compile(
        r"\b(refactor|debug|stack ?trace|compile|function|class|regex|sql|"
        r"typescript|python|javascript|rust|golang|java\b|bug|unit test|"
        r"implement|code|api|endpoint)\b", re.I)),
    ("reasoning", re.compile(
        r"\b(prove|derive|step by step|reason|analy[sz]e|why does|trade-?off|"
        r"compare|evaluate|plan|strategy|explain how)\b", re.I)),
    ("extraction", re.compile(
        r"\b(extract|parse|classif|categor|label|tag|json|schema|"
        r"summar|tl;?dr|rewrite|translate)\b", re.I)),
    ("chat", re.compile(r".", re.S)),  # fallback, always matches
]

# Which model families are known to be tuned for which intent. Used only as a
# tiebreak nudge, never as a hard filter, because a general model often does
# a specialist job well enough and the measured numbers matter more.
FAMILY_AFFINITY: dict[Intent, tuple[str, ...]] = {
    "code": ("coder", "code", "devstral", "codestral"),
    "reasoning": ("r1", "reason", "think", "qwq"),
    "embedding": ("embed",),
}


def detect_intent(prompt: str) -> Intent:
    """Classify a prompt with regexes, not a model.

    Using an LLM to pick an LLM would add a cold load and several seconds to
    every request, which is exactly the latency this router exists to avoid.
    """
    for intent, pattern in INTENT_PATTERNS:
        if pattern.search(prompt):
            return intent
    return "chat"


def estimate_tokens(text: str) -> int:
    """Rough token count for budgeting, assuming ~4 characters per token.

    Deliberately crude. It is used to check context fit and predict prefill
    time, where being off by 20 percent changes nothing. Anything needing a
    real count should tokenise properly.
    """
    return max(1, len(text) // 4)


# ---------------------------------------------------------------------
# Objectives
# ---------------------------------------------------------------------

@dataclass(frozen=True)
class Objective:
    """What "best" means for one request.

    Weights are multiplied against normalised 0..1 sub-scores. They do not
    need to sum to 1; only their ratios matter.
    """

    name: str
    speed: float = 1.0
    capability: float = 1.0
    residency: float = 1.0
    fit: float = 1.0

    @staticmethod
    def get(name: str) -> "Objective":
        """Look up an objective by name, rejecting unknown ones.

        Silently falling back to balanced would hide a typo: the caller asks
        for `qualty`, gets balanced routing, and has no way to tell that the
        request was ignored.
        """
        try:
            return OBJECTIVES[name]
        except KeyError:
            known = ", ".join(sorted(OBJECTIVES))
            raise ValueError(f"unknown objective {name!r}; known objectives: {known}") from None


OBJECTIVES: dict[str, Objective] = {
    # Answer now. Strongly prefers whatever is already warm and fits in VRAM.
    "interactive": Objective("interactive", speed=3.0, capability=0.8, residency=3.0, fit=2.0),
    # Quality matters more than a few seconds of latency.
    "quality":     Objective("quality",     speed=0.6, capability=3.0, residency=0.4, fit=1.2),
    # Long unattended job: load cost amortises, throughput dominates.
    "batch":       Objective("batch",       speed=2.0, capability=1.5, residency=0.2, fit=2.5),
    # Sensible default.
    "balanced":    Objective("balanced",    speed=1.5, capability=1.5, residency=1.0, fit=1.5),
}


INSTRUCTION_INTENTS = frozenset({"chat", "code", "reasoning", "extraction"})

_BASE_MODEL_RE = re.compile(r"[:\-]base\b|\bbase$")


def _is_base_model(name: str) -> bool:
    """True for models published without instruction tuning.

    Ollama does not flag this in its metadata, so the tag is the only signal
    available. Publishers mark it consistently (`:1.5b-base`, `-base`), and a
    false positive costs one model on the shortlist while a false negative
    costs an answer that ignores the question entirely.
    """
    return bool(_BASE_MODEL_RE.search(name.lower()))


@dataclass
class Candidate:
    """One model scored for one request."""

    name: str
    score: float = 0.0
    fits_vram: bool = False
    resident: bool = False
    predicted_s: float = 0.0
    gen_tps: float = 0.0
    load_s: float = 0.0
    measured: bool = False
    parts: dict[str, float] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "model": self.name,
            "score": round(self.score, 4),
            "predicted_s": round(self.predicted_s, 2),
            "gen_tps": round(self.gen_tps, 1),
            "load_s": round(self.load_s, 1),
            "resident": self.resident,
            "fits_vram": self.fits_vram,
            "measured": self.measured,
            "parts": {k: round(v, 3) for k, v in self.parts.items()},
            "notes": self.notes,
        }


@dataclass
class Decision:
    """The router's answer, including why and what it rejected."""

    chosen: str | None
    intent: Intent
    objective: str
    reason: str
    considered: list[Candidate]
    excluded: list[dict[str, str]]
    predicted_s: float = 0.0

    def predict_seconds(self, max_output_tokens: int) -> float:
        """Re-predict wall-clock for a different output budget.

        Uses the same formula as scoring (load penalty plus generation time at
        the winner's measured rate), so a revised figure stays comparable with
        the ones recorded at routing time.
        """
        if not self.considered:
            return self.predicted_s
        top = self.considered[0]
        load_penalty = 0.0 if top.resident else top.load_s
        if top.gen_tps <= 0:
            return self.predicted_s
        return load_penalty + max_output_tokens / top.gen_tps

    def as_dict(self) -> dict[str, Any]:
        return {
            "chosen": self.chosen,
            "intent": self.intent,
            "objective": self.objective,
            "reason": self.reason,
            "predicted_s": round(self.predicted_s, 2),
            "considered": [c.as_dict() for c in self.considered],
            "excluded": self.excluded,
        }


class Router:
    """Scores installed models against a request.

    vram_bytes is the usable VRAM budget. When it is 0 the fit test is
    skipped entirely rather than assumed to pass, so a machine where we
    cannot read GPU memory degrades to ranking on measured speed alone.
    """

    def __init__(self, registry: Registry, *, vram_bytes: int = 0,
                 vram_headroom: float = 0.90) -> None:
        self.registry = registry
        self.vram_bytes = vram_bytes
        self.vram_headroom = vram_headroom

    @property
    def vram_budget(self) -> int:
        """Usable VRAM after leaving room for the KV cache and desktop.

        A model whose weights exactly equal total VRAM will still spill,
        because the context window needs memory too.
        """
        return int(self.vram_bytes * self.vram_headroom)

    def route(self, prompt: str, *, objective: str = "balanced",
              resident: list[str] | None = None,
              require: list[str] | None = None,
              exclude: list[str] | None = None,
              intent: Intent | None = None,
              max_output_tokens: int = 512) -> Decision:
        obj = Objective.get(objective)
        # An explicit intent wins over the regexes: a caller embedding this in
        # a tool usually knows what it is asking for, and the classifier is a
        # fallback for when nobody said.
        intent = intent or detect_intent(prompt)
        resident_set = set(resident or [])
        exclude_set = set(exclude or [])
        required_caps = set(require or [])
        if intent == "embedding":
            required_caps.add("embedding")

        prompt_tokens = estimate_tokens(prompt)
        models = self.registry.models()
        perf_by_model = {m["name"]: self.registry.perf(m["name"]) for m in models}

        candidates: list[Candidate] = []
        excluded: list[dict[str, str]] = []

        for m in models:
            name = m["name"]
            if name in exclude_set:
                excluded.append({"model": name, "why": "explicitly excluded"})
                continue

            caps = set(m["capabilities"])
            # Embedding models cannot chat, and chat models cannot embed.
            # Treat that as a hard filter: no amount of speed makes a model
            # able to do a thing it structurally cannot do.
            missing = required_caps - caps
            if missing:
                excluded.append({
                    "model": name,
                    "why": f"lacks required capability: {', '.join(sorted(missing))}",
                })
                continue
            if intent != "embedding" and "embedding" in caps and "completion" not in caps:
                excluded.append({"model": name, "why": "embedding-only model, cannot generate text"})
                continue

            # Base models are raw next-token predictors: given an instruction
            # they continue it rather than answer it. That is a correctness
            # failure no throughput advantage can offset, so exclude them from
            # instruction-shaped work outright instead of scoring them down
            # and watching them win on speed anyway. They stay eligible for
            # completion intents, which is what they are actually good at.
            if intent in INSTRUCTION_INTENTS and _is_base_model(name):
                excluded.append({"model": name, "why": "base model, not instruction tuned"})
                continue

            ctx = m["context_length"]
            needed = prompt_tokens + max_output_tokens
            if ctx and needed > ctx:
                excluded.append({
                    "model": name,
                    "why": f"context window too small: needs ~{needed} tokens, has {ctx}",
                })
                continue

            candidates.append(self._score(m, perf_by_model[name], obj, intent,
                                          resident_set, prompt_tokens, max_output_tokens))

        candidates.sort(key=lambda c: c.score, reverse=True)

        if not candidates:
            return Decision(None, intent, obj.name,
                            "no installed model can serve this request",
                            [], excluded)

        best = candidates[0]
        return Decision(best.name, intent, obj.name, self._explain(best, candidates, intent, obj),
                        candidates, excluded, best.predicted_s)

    # ---- scoring -------------------------------------------------------

    def _score(self, m: dict[str, Any], perf: Perf, obj: Objective, intent: Intent,
               resident: set[str], prompt_tokens: int, max_output: int) -> Candidate:
        name = m["name"]
        c = Candidate(name=name, measured=perf.measured)
        c.resident = name in resident

        # --- fit: does it sit entirely in VRAM? --------------------------
        if self.vram_budget > 0:
            c.fits_vram = m["size_bytes"] <= self.vram_budget
        else:
            c.fits_vram = True  # unknown; do not penalise
        if perf.spills_to_cpu:
            # A measurement beats an estimate. If we watched it spill, it spills.
            c.fits_vram = False
            c.notes.append(f"measured only {perf.gpu_fraction:.0%} on GPU")
        fit_score = 1.0 if c.fits_vram else 0.15
        if not c.fits_vram:
            c.notes.append("spills to CPU, expect a large slowdown")

        # --- speed: measured if we have it, else estimated ---------------
        if perf.measured and perf.gen_tps > 0:
            tps = perf.gen_tps
            if not c.fits_vram:
                # The measured rate was recorded while spilling, so the cost
                # of spilling is already priced into tok/s. Penalising fit
                # again here would count the same problem twice and bury a
                # model that is demonstrably fast in spite of the split.
                fit_score = 0.75
                c.notes.append("spill already reflected in the measured rate")
        else:
            tps = self._estimate_tps(m, c.fits_vram)
            c.notes.append("speed estimated, never measured")
        c.gen_tps = tps
        # 60 tok/s is treated as "fast enough that more does not help a human".
        speed_score = min(1.0, tps / 60.0)

        # --- residency: cold load is often the whole cost ----------------
        load_s = perf.cold_load_s or self._estimate_load_s(m)
        if c.resident:
            residency_score = 1.0
            load_penalty = 0.0
        else:
            load_penalty = load_s
            # 30s of loading scores 0; instant scores 1.
            residency_score = max(0.0, 1.0 - load_s / 30.0)
            c.notes.append(f"cold start, about {load_s:.0f}s to load")

        # --- capability: size and family affinity ------------------------
        capability_score = self._capability(m, intent)

        c.load_s = load_s
        c.predicted_s = load_penalty + (max_output / tps if tps > 0 else 999.0)

        c.parts = {
            "speed": speed_score,
            "capability": capability_score,
            "residency": residency_score,
            "fit": fit_score,
        }
        total_weight = obj.speed + obj.capability + obj.residency + obj.fit
        c.score = (
            obj.speed * speed_score
            + obj.capability * capability_score
            + obj.residency * residency_score
            + obj.fit * fit_score
        ) / total_weight

        if not perf.measured:
            # Discount unmeasured models hard. Without this an optimistic
            # estimate outranks an observed fact, and the router keeps
            # preferring whatever it knows least about, which is exactly
            # backwards: the estimate is a guess from parameter count, while
            # the measurement is what this machine actually did. The gap has
            # to be wide enough that a favourable guess cannot beat a real
            # number, while still letting a never-benchmarked model win when
            # nothing measured is eligible at all.
            c.score *= 0.55
        return c

    def _capability(self, m: dict[str, Any], intent: Intent) -> float:
        """How capable this model is likely to be for this intent.

        Uses total parameters, not active ones: a mixture-of-experts model
        holds all its knowledge even though only some experts fire per
        token. Speed is scored separately from knowledge on purpose.
        """
        total = m["total_params"] or 0
        if total <= 0:
            base = 0.4
        else:
            billions = total / 1e9
            # Diminishing returns: 30B is better than 7B, but not four times.
            base = min(1.0, (billions / 30.0) ** 0.5)

        name_l = m["name"].lower()
        family_l = (m["family"] or "").lower()
        for token in FAMILY_AFFINITY.get(intent, ()):
            if token in name_l or token in family_l:
                base = min(1.0, base + 0.25)
                break

        # Heavy quantisation costs quality.
        quant = (m["quantization"] or "").upper()
        if quant.startswith(("Q2", "Q3")):
            base *= 0.75
        elif quant.startswith("Q8") or quant == "F16":
            base = min(1.0, base * 1.05)

        # Base models are excluded outright for instruction intents (see
        # _is_base_model), so no scoring penalty is needed here.
        return base

    def _estimate_tps(self, m: dict[str, Any], fits: bool) -> float:
        """Guess generation speed for a model we have never measured.

        Based on active parameters, since that is what actually gets
        multiplied per token. Only used to rank an unmeasured model until a
        real measurement replaces it, and always flagged in the notes.
        """
        active = m["active_params"] or m["total_params"] or 7e9
        billions = active / 1e9
        tps = 180.0 / max(1.0, billions) ** 0.85
        if not fits:
            # Measured spill cost: the 14B at 45 percent GPU ran roughly four
            # times slower than its fully resident peers would suggest.
            tps *= 0.25
        return max(1.0, tps)

    def _estimate_load_s(self, m: dict[str, Any]) -> float:
        """Rough cold-load time from model size, assuming ~1.2 GB/s off disk."""
        return max(1.0, m["size_bytes"] / 1.2e9)

    def _explain(self, best: Candidate, all_c: list[Candidate],
                 intent: Intent, obj: Objective) -> str:
        bits = [f"{best.name} for a {intent} prompt under the {obj.name} objective"]
        if best.resident:
            bits.append("already resident, so no load cost")
        elif best.fits_vram:
            bits.append("fits entirely in VRAM")
        if best.measured:
            bits.append(f"measured {best.gen_tps:.0f} tok/s")
        else:
            bits.append(f"estimated {best.gen_tps:.0f} tok/s, not yet benchmarked")

        runner_up = next((c for c in all_c[1:] if c.name != best.name), None)
        if runner_up:
            margin = best.score - runner_up.score
            if margin < 0.05:
                bits.append(f"narrowly ahead of {runner_up.name}")
            else:
                bits.append(f"clearly ahead of {runner_up.name}")
        return "; ".join(bits)
