import { describe, expect, it } from "vitest";

import { BASELINE_EVAL_SET, runEval, type EvalRunner, type EvalSet } from "./eval";

/** A runner that always succeeds with a fixed response. */
function fixedRunner(response: string, latencyMs = 100, costUsd = 0.001): EvalRunner {
  return async () => ({ ok: true, response, latencyMs, tokensPerSec: 50, costUsd });
}

/** A runner that fails every case. */
const failingRunner: EvalRunner = async () => ({
  ok: false,
  latencyMs: 0,
  tokensPerSec: 0,
  costUsd: 0,
  error: "boom",
});

describe("runEval", () => {
  it("grades each case and reports pass/fail per axis", async () => {
    const set: EvalSet = {
      version: "t1",
      cases: [
        { id: "a", axis: "json", prompt: "p", grade: (r) => r === "yes" },
        { id: "b", axis: "json", prompt: "p", grade: (r) => r === "yes" },
        { id: "c", axis: "json", prompt: "p", grade: () => false },
      ],
    };
    const result = await runEval(1, set, fixedRunner("yes"));
    const json = result.axes.find((a) => a.axis === "json");
    expect(json).toMatchObject({ gradedCases: 3, passedCases: 2, measured: true });
    expect(json?.score).toBe(67);
  });

  it("marks an ungraded axis as unmeasured rather than inventing a score", async () => {
    const set: EvalSet = {
      version: "t2",
      cases: [{ id: "a", axis: "quality", prompt: "p" }], // no grade fn
    };
    const result = await runEval(1, set, fixedRunner("anything"));
    const quality = result.axes.find((a) => a.axis === "quality");
    expect(quality?.measured).toBe(false);
    expect(quality?.score).toBeUndefined();
  });

  it("treats a failed call as a fail for grading but keeps its cost", async () => {
    const set: EvalSet = {
      version: "t3",
      cases: [{ id: "a", axis: "json", prompt: "p", grade: () => true }],
    };
    const result = await runEval(1, set, failingRunner);
    expect(result.axes[0].passedCases).toBe(0);
    expect(result.cases[0].ok).toBe(false);
  });

  it("reports the eval-set version so mixed-version comparisons are visible", async () => {
    const set: EvalSet = { version: "v-xyz", cases: [] };
    const result = await runEval(1, set, fixedRunner("x"));
    expect(result.evalSetVersion).toBe("v-xyz");
  });

  it("computes median tokens/sec from successful cases only", async () => {
    const runner: EvalRunner = async (c) =>
      c.id === "slow"
        ? { ok: true, response: "x", latencyMs: 1, tokensPerSec: 10, costUsd: 0 }
        : { ok: true, response: "x", latencyMs: 1, tokensPerSec: 100, costUsd: 0 };
    const set: EvalSet = {
      version: "t4",
      cases: [
        { id: "slow", axis: "a", prompt: "p" },
        { id: "fast", axis: "a", prompt: "p" },
        { id: "fast2", axis: "a", prompt: "p" },
      ],
    };
    const result = await runEval(1, set, runner);
    expect(result.observedTokensPerSec).toBe(100); // median of [10,100,100]
  });

  it("sums cost across all cases including failures", async () => {
    const runner: EvalRunner = async (c) => ({
      ok: c.id !== "bad",
      response: "x",
      latencyMs: 1,
      tokensPerSec: 1,
      costUsd: 0.5,
    });
    const set: EvalSet = {
      version: "t5",
      cases: [
        { id: "good", axis: "a", prompt: "p" },
        { id: "bad", axis: "a", prompt: "p" },
      ],
    };
    const result = await runEval(1, set, runner);
    expect(result.observedCostUsd).toBe(1); // both legs counted
  });
});

describe("BASELINE_EVAL_SET", () => {
  it("is fully graded and self-consistent", () => {
    for (const c of BASELINE_EVAL_SET.cases) {
      expect(typeof c.grade).toBe("function");
    }
    expect(BASELINE_EVAL_SET.version).toMatch(/baseline-/);
  });

  it("its graders accept correct answers and reject wrong ones", () => {
    const [json, words, arith] = BASELINE_EVAL_SET.cases;
    expect(json.grade!('{"name":"a","count":2}')).toBe(true);
    expect(json.grade!("not json")).toBe(false);
    expect(words.grade!("one two three")).toBe(true);
    expect(words.grade!("one two")).toBe(false);
    expect(arith.grade!("102")).toBe(true);
    expect(arith.grade!("101")).toBe(false);
  });
});
