"""Tests for the router core. Run with: python3 -m unittest discover -s tests

No network and no Ollama required: the registry is seeded with the real
numbers measured on the development machine, so the scoring logic is tested
against observed behaviour rather than invented figures.
"""

from __future__ import annotations

import sys
import unittest
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ollama_router.registry import Registry  # noqa: E402
from ollama_router.router import (  # noqa: E402
    Router, detect_intent, estimate_tokens, Objective,
)


@dataclass
class FakeCard:
    """Stands in for ollama.ModelCard without needing a live daemon."""
    name: str
    size_bytes: int
    family: str = ""
    parameter_size: str = ""
    quantization: str = "Q4_K_M"
    capabilities: tuple = ("completion",)
    context_length: int = 32768
    total_params: int = 0
    active_params: int = 0
    expert_count: int = 0
    expert_used: int = 0


GB = 10 ** 9

# Real models and sizes from the development machine.
FIXTURES = [
    FakeCard("nomic-embed-text:latest", int(0.3 * GB), "nomic-bert", "137M", "F16",
             ("embedding",), 2048, 137_000_000, 137_000_000),
    FakeCard("qwen2.5-coder:1.5b-base", int(1.0 * GB), "qwen2", "1.5B", "Q4_K_M",
             ("completion",), 32768, 1_540_000_000, 1_540_000_000),
    FakeCard("qwen2.5-coder:7b", int(4.7 * GB), "qwen2", "7.6B", "Q4_K_M",
             ("completion", "tools"), 32768, 7_620_000_000, 7_620_000_000),
    FakeCard("llama3.1:latest", int(4.9 * GB), "llama", "8.0B", "Q4_K_M",
             ("completion", "tools"), 131072, 8_030_000_000, 8_030_000_000),
    FakeCard("qwen3:14b", int(9.3 * GB), "qwen3", "14.8B", "Q4_K_M",
             ("completion", "tools", "thinking"), 40960, 14_768_000_000, 14_768_000_000),
    FakeCard("qwen3:30b-a3b", int(18.6 * GB), "qwen3moe", "30.5B", "Q4_K_M",
             ("completion", "tools", "thinking"), 40960, 30_500_000_000,
             13_400_000_000, expert_count=128, expert_used=8),
    FakeCard("nemotron-3.5-lightning:latest", int(25.4 * GB), "nemotron", "32.9B",
             "Q4_K_M", ("completion",), 131072, 32_900_000_000, 32_900_000_000),
    # A chat model with a deliberately small window, so the context-fit rule
    # can be tested on a model that is not already excluded for capability.
    FakeCard("tiny-ctx-chat:latest", int(0.8 * GB), "llama", "1.1B", "Q4_K_M",
             ("completion",), 4096, 1_100_000_000, 1_100_000_000),
]

VRAM_16GB = 16376 * 1024 * 1024


def seeded_registry() -> Registry:
    reg = Registry(":memory:")
    for card in FIXTURES:
        reg.upsert_model(card)
    return reg


def chosen_of(decision) -> str:
    """Assert a model was chosen and return its name.

    Decision.chosen is Optional by design (an empty registry chooses
    nothing), so tests that go on to index the result must narrow it first.
    """
    assert decision.chosen is not None, f"expected a choice, got none: {decision.reason}"
    return decision.chosen


class TestIntent(unittest.TestCase):
    def test_code_prompts(self):
        for p in ["refactor this function", "fix the stack trace",
                  "write a unit test for the API endpoint"]:
            self.assertEqual(detect_intent(p), "code", p)

    def test_reasoning_prompts(self):
        for p in ["explain how consensus works step by step",
                  "compare the trade-offs of these designs"]:
            self.assertEqual(detect_intent(p), "reasoning", p)

    def test_embedding_prompt(self):
        self.assertEqual(detect_intent("embed these documents for similarity search"),
                         "embedding")

    def test_plain_chat_falls_back(self):
        self.assertEqual(detect_intent("hello, how are you today"), "chat")

    def test_intent_is_deterministic(self):
        # Routing must not vary run to run for the same input.
        p = "debug this python function"
        self.assertEqual(detect_intent(p), detect_intent(p))


class TestTokenEstimate(unittest.TestCase):
    def test_scales_with_length(self):
        self.assertLess(estimate_tokens("short"), estimate_tokens("word " * 500))

    def test_never_zero(self):
        # A zero would make context-fit maths divide badly.
        self.assertGreaterEqual(estimate_tokens(""), 1)


class TestCapabilityFiltering(unittest.TestCase):
    def setUp(self):
        self.reg = seeded_registry()
        self.router = Router(self.reg, vram_bytes=VRAM_16GB)

    def test_embedding_model_never_serves_chat(self):
        d = self.router.route("tell me a story about the sea")
        self.assertIsNotNone(d.chosen)
        self.assertNotEqual(d.chosen, "nomic-embed-text:latest")
        self.assertTrue(any("embedding-only" in e["why"] for e in d.excluded))

    def test_embedding_intent_picks_the_embedding_model(self):
        d = self.router.route("embed this text for similarity search")
        self.assertEqual(d.chosen, "nomic-embed-text:latest")

    def test_tools_requirement_excludes_models_without_it(self):
        d = self.router.route("call the weather API", require=["tools"])
        chosen = self.reg.model(chosen_of(d))
        self.assertIn("tools", chosen["capabilities"])
        self.assertTrue(any("lacks required capability" in e["why"] for e in d.excluded))

    def test_explicit_exclusion_is_honoured(self):
        first = self.router.route("write a python function", objective="interactive")
        second = self.router.route("write a python function", objective="interactive",
                                   exclude=[chosen_of(first)])
        self.assertNotEqual(second.chosen, first.chosen)

    def test_context_window_too_small_is_excluded(self):
        # tiny-ctx-chat has a 4096 window; ask for far more than that.
        huge = "word " * 4000  # ~5000 tokens
        d = self.router.route(huge, max_output_tokens=2000)
        reasons = [e["why"] for e in d.excluded if e["model"] == "tiny-ctx-chat:latest"]
        self.assertTrue(reasons and "context window too small" in reasons[0],
                        f"expected a context exclusion, got {d.excluded}")


class TestVramFit(unittest.TestCase):
    def setUp(self):
        self.reg = seeded_registry()
        self.router = Router(self.reg, vram_bytes=VRAM_16GB)

    def test_oversized_model_is_marked_as_spilling(self):
        d = self.router.route("hello")
        nemotron = next(c for c in d.considered if c.name.startswith("nemotron"))
        self.assertFalse(nemotron.fits_vram)
        self.assertTrue(any("spills to CPU" in n for n in nemotron.notes))

    def test_model_within_budget_fits(self):
        d = self.router.route("hello")
        small = next(c for c in d.considered if c.name == "qwen2.5-coder:7b")
        self.assertTrue(small.fits_vram)

    def test_headroom_is_reserved_for_kv_cache(self):
        # A model exactly at total VRAM must not count as fitting, because
        # the context window needs memory too.
        self.assertLess(self.router.vram_budget, self.router.vram_bytes)

    def test_unknown_vram_does_not_penalise_anything(self):
        blind = Router(self.reg, vram_bytes=0)
        d = blind.route("hello")
        self.assertTrue(all(c.fits_vram for c in d.considered))

    def test_measured_spill_overrides_size_estimate(self):
        # qwen3:14b is 9.3GB so it looks like it fits, but it was measured
        # at 45 percent on GPU. The measurement must win.
        self.reg.record_measurement("qwen3:14b", "benchmark", gen_tps=7.8,
                                    load_s=55.5, gpu_fraction=0.45, output_tokens=40)
        d = self.router.route("hello")
        c = next(c for c in d.considered if c.name == "qwen3:14b")
        self.assertFalse(c.fits_vram)
        self.assertTrue(any("45% on GPU" in n for n in c.notes))


class TestMeasurementsBeatHeuristics(unittest.TestCase):
    """The core claim of this router, proven against real measured numbers."""

    def setUp(self):
        self.reg = seeded_registry()
        self.router = Router(self.reg, vram_bytes=VRAM_16GB)
        # Measured on an RTX 4090 Laptop, 16GB VRAM.
        self.reg.record_measurement("qwen3:14b", "benchmark", gen_tps=7.8,
                                    load_s=55.46, gpu_fraction=0.45, output_tokens=40)
        self.reg.record_measurement("qwen3:30b-a3b", "benchmark", gen_tps=26.5,
                                    load_s=5.78, gpu_fraction=0.46, output_tokens=40)
        self.reg.record_measurement("qwen2.5-coder:1.5b-base", "benchmark",
                                    gen_tps=250.6, load_s=14.24, gpu_fraction=1.0,
                                    output_tokens=34)

    def test_moe_30b_outranks_dense_14b_despite_being_larger(self):
        d = self.router.route("summarise this text", objective="batch")
        names = [c.name for c in d.considered]
        self.assertLess(names.index("qwen3:30b-a3b"), names.index("qwen3:14b"),
                        "the 30B MoE measured 3.4x faster, so it must rank higher")

    def test_measured_speed_is_used_not_estimated(self):
        d = self.router.route("hello")
        c = next(c for c in d.considered if c.name == "qwen3:30b-a3b")
        self.assertTrue(c.measured)
        self.assertAlmostEqual(c.gen_tps, 26.5, places=1)

    def test_unmeasured_models_are_flagged_as_guesses(self):
        d = self.router.route("hello")
        c = next(c for c in d.considered if c.name == "llama3.1:latest")
        self.assertFalse(c.measured)
        self.assertTrue(any("estimated" in n for n in c.notes))

    def test_median_is_used_so_one_bad_sample_does_not_dominate(self):
        for tps in (100.0, 102.0, 4.0):  # one run collided with another load
            self.reg.record_measurement("qwen2.5-coder:7b", "benchmark",
                                        gen_tps=tps, gpu_fraction=1.0, output_tokens=40)
        perf = self.reg.perf("qwen2.5-coder:7b")
        self.assertAlmostEqual(perf.gen_tps, 100.0, places=1)


class TestObjectives(unittest.TestCase):
    def setUp(self):
        self.reg = seeded_registry()
        self.router = Router(self.reg, vram_bytes=VRAM_16GB)
        self.reg.record_measurement("qwen2.5-coder:1.5b-base", "benchmark",
                                    gen_tps=250.6, load_s=14.24, gpu_fraction=1.0,
                                    output_tokens=34)
        self.reg.record_measurement("qwen3:30b-a3b", "benchmark", gen_tps=26.5,
                                    load_s=5.78, gpu_fraction=0.46, output_tokens=40)

    def test_residency_raises_a_models_score(self):
        # Residency is a factor, not an override: it must always help, but a
        # far faster model is still allowed to win on the numbers.
        cold = self.router.route("write a function", objective="interactive")
        warm = self.router.route("write a function", objective="interactive",
                                 resident=["qwen3:30b-a3b"])
        cold_c = next(c for c in cold.considered if c.name == "qwen3:30b-a3b")
        warm_c = next(c for c in warm.considered if c.name == "qwen3:30b-a3b")
        self.assertGreater(warm_c.score, cold_c.score)
        self.assertLess(warm_c.predicted_s, cold_c.predicted_s)

    def test_residency_decides_between_comparable_models(self):
        # Residency should break a tie, not overturn a large speed gap. Give
        # two models near-identical measured throughput so warmth is the only
        # thing separating them.
        self.reg.record_measurement("qwen2.5-coder:7b", "benchmark", gen_tps=30.0,
                                    load_s=6.0, gpu_fraction=1.0, output_tokens=40)
        self.reg.record_measurement("llama3.1:latest", "benchmark", gen_tps=30.0,
                                    load_s=6.0, gpu_fraction=1.0, output_tokens=40)
        others = ["qwen2.5-coder:1.5b-base", "tiny-ctx-chat:latest",
                  "qwen3:14b", "qwen3:30b-a3b", "nemotron-3.5-lightning:latest"]
        warm = self.router.route("explain this", objective="interactive",
                                 exclude=others, resident=["llama3.1:latest"])
        self.assertEqual(warm.chosen, "llama3.1:latest")

    def test_residency_does_not_overturn_a_large_speed_gap(self):
        # The 14B measured 7.8 tok/s against the 30B MoE at 26.5. Even warm,
        # the slow model loses, because 512 tokens at 7.8 tok/s costs far
        # more than the 30B's cold load plus its generation.
        self.reg.record_measurement("qwen3:14b", "benchmark", gen_tps=7.8,
                                    load_s=55.46, gpu_fraction=0.45, output_tokens=40)
        small = ["qwen2.5-coder:1.5b-base", "tiny-ctx-chat:latest",
                 "qwen2.5-coder:7b", "llama3.1:latest"]
        warm = self.router.route("explain this", objective="interactive",
                                 exclude=small, resident=["qwen3:14b"])
        self.assertEqual(warm.chosen, "qwen3:30b-a3b")

    def test_base_models_are_excluded_from_instruction_work(self):
        # A base model continues a prompt instead of answering it, so it must
        # not be selectable for instruction-shaped intents no matter how fast
        # it is. The 1.5b-base measured 193 tok/s and would otherwise win.
        d = self.router.route("write a function", objective="interactive")
        self.assertNotEqual(d.chosen, "qwen2.5-coder:1.5b-base")
        reasons = [e["why"] for e in d.excluded
                   if e["model"] == "qwen2.5-coder:1.5b-base"]
        self.assertTrue(reasons and "base model" in reasons[0],
                        f"expected a base-model exclusion, got {d.excluded}")

    def test_base_models_stay_eligible_for_completion(self):
        # Excluding them everywhere would waste a genuinely fast model; they
        # are good at raw continuation, which is what they were trained for.
        names = [c.name for c in
                 self.router.route("def fib(n):", intent="completion").considered]
        self.assertIn("qwen2.5-coder:1.5b-base", names)

    def test_a_measured_model_outranks_an_unmeasured_guess(self):
        # An estimate must never beat an observation: otherwise the router
        # prefers whatever it knows least about.
        d = self.router.route("hello", objective="interactive",
                              resident=["qwen2.5-coder:1.5b-base"])
        top = d.considered[0]
        self.assertTrue(top.measured,
                        f"unmeasured {top.name} outranked every measured model")

    def test_quality_tolerates_a_slower_bigger_model(self):
        fast = self.router.route("explain this design", objective="interactive")
        good = self.router.route("explain this design", objective="quality")
        fast_size = self.reg.model(chosen_of(fast))["total_params"]
        good_size = self.reg.model(chosen_of(good))["total_params"]
        self.assertGreaterEqual(good_size, fast_size)

    def test_unknown_objective_is_rejected(self):
        # Falling back silently would hide a typo: the caller asks for
        # 'qualty', gets balanced routing, and never learns it was ignored.
        with self.assertRaises(ValueError) as ctx:
            Objective.get("nonsense")
        self.assertIn("nonsense", str(ctx.exception))
        self.assertIn("quality", str(ctx.exception))  # lists the valid names

    def test_known_objectives_all_resolve(self):
        for name in ("interactive", "quality", "batch", "balanced"):
            self.assertEqual(Objective.get(name).name, name)

    def test_predict_seconds_rescales_with_the_token_budget(self):
        # The server widens num_predict for thinking models, so the recorded
        # prediction has to be rescaled or the accuracy self-check compares
        # a prediction for one budget against a run at another.
        d = self.router.route("hello", objective="balanced")
        small = d.predict_seconds(100)
        large = d.predict_seconds(400)
        self.assertGreater(large, small)
        top = d.considered[0]
        expected_gap = 300 / top.gen_tps
        self.assertAlmostEqual(large - small, expected_gap, places=4)

    def test_predict_seconds_includes_load_when_cold(self):
        cold = self.router.route("hello", objective="balanced")
        top = cold.considered[0]
        self.assertFalse(top.resident)
        # A cold model pays its load time on top of generation.
        self.assertAlmostEqual(cold.predict_seconds(0), top.load_s, places=4)

    def test_residency_changes_the_prediction(self):
        cold = self.router.route("hello", objective="balanced")
        warm = self.router.route("hello", objective="balanced", resident=[chosen_of(cold)])
        warm_c = next(c for c in warm.considered if c.name == cold.chosen)
        cold_c = next(c for c in cold.considered if c.name == cold.chosen)
        self.assertLess(warm_c.predicted_s, cold_c.predicted_s)


class TestDecisionShape(unittest.TestCase):
    def setUp(self):
        self.reg = seeded_registry()
        self.router = Router(self.reg, vram_bytes=VRAM_16GB)

    def test_every_decision_explains_itself(self):
        d = self.router.route("write a python function")
        self.assertTrue(d.reason)
        self.assertIn(d.chosen, d.reason)

    def test_considered_models_are_ranked(self):
        d = self.router.route("hello")
        scores = [c.score for c in d.considered]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_empty_registry_returns_no_choice_not_a_crash(self):
        empty = Router(Registry(":memory:"), vram_bytes=VRAM_16GB)
        d = empty.route("hello")
        self.assertIsNone(d.chosen)
        self.assertIn("no installed model", d.reason)

    def test_decision_serialises(self):
        d = self.router.route("hello")
        payload = d.as_dict()
        self.assertEqual(payload["chosen"], d.chosen)
        self.assertIsInstance(payload["considered"], list)


class TestRegistry(unittest.TestCase):
    def setUp(self):
        self.reg = seeded_registry()

    def test_upsert_is_idempotent(self):
        before = len(self.reg.models())
        for card in FIXTURES:
            self.reg.upsert_model(card)
        self.assertEqual(len(self.reg.models()), before)

    def test_forget_missing_drops_uninstalled_models(self):
        keep = [FIXTURES[0].name, FIXTURES[1].name]
        self.reg.forget_missing(keep)
        self.assertEqual({m["name"] for m in self.reg.models()}, set(keep))

    def test_deleting_a_model_deletes_its_measurements(self):
        self.reg.record_measurement("qwen3:14b", "benchmark", gen_tps=7.8)
        self.assertEqual(self.reg.measurement_count("qwen3:14b"), 1)
        self.reg.forget_missing([FIXTURES[0].name])
        self.assertEqual(self.reg.measurement_count("qwen3:14b"), 0)

    def test_warm_runs_do_not_pollute_cold_load_estimate(self):
        self.reg.record_measurement("qwen3:14b", "benchmark", gen_tps=8.0,
                                    load_s=55.0, was_resident=False)
        self.reg.record_measurement("qwen3:14b", "benchmark", gen_tps=8.0,
                                    load_s=0.01, was_resident=True)
        self.assertAlmostEqual(self.reg.perf("qwen3:14b").cold_load_s, 55.0, places=1)

    def test_unmeasured_model_reports_not_measured(self):
        self.assertFalse(self.reg.perf("llama3.1:latest").measured)

    def test_route_round_trip(self):
        rid = self.reg.record_route(chosen="qwen3:14b", intent="code",
                                    objective="balanced", reason="because",
                                    considered=[], predicted_s=3.0)
        self.reg.close_route(rid, actual_s=3.5, output_tokens=100)
        acc = self.reg.prediction_accuracy()
        self.assertEqual(acc["samples"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
