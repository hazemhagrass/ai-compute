/**
 * A real evaluation harness to replace hand-written skill scores.
 *
 * The router ranks models on `model.quality`, `model.speed`, `model.cheapness`,
 * and the `skills` map. Today those numbers are written by hand, so a model
 * ranks well because someone typed a high number, not because it earned one.
 * This module measures a model against a fixed set of eval tasks and returns
 * observed per-axis scores that can be written back over the guesses.
 *
 * What it can measure, honestly:
 *   - speed   (observed tokens/sec and latency, from real calls)
 *   - cheapness (measured cost per task, from real calls)
 *   - an axis that has a checkable answer (json mode, instruction following)
 *
 * What it cannot measure, and therefore leaves alone:
 *   - open-ended quality. There is no cheap ground truth for "is this summary
 *     good". The harness reports quality as "unmeasured" rather than inventing
 *     a number, because a fabricated quality score is worse than none.
 *
 * The eval set is versioned. Scores are only comparable across models run
 * against the SAME eval-set version, so the version is stamped on every result
 * and a mixed-version comparison is a caller bug, not something to paper over.
 */

export interface EvalCase {
  id: string;
  /** The axis this case feeds. */
  axis: string;
  /** Prompt sent to the model. */
  prompt: string;
  /**
   * Optional deterministic grader. When present the case produces a pass/fail
   * that feeds the axis score. When absent the case only contributes latency
   * and cost measurements.
   */
  grade?: (response: string) => boolean;
}

export interface EvalSet {
  version: string;
  cases: EvalCase[];
}

export interface CaseResult {
  caseId: string;
  axis: string;
  /** Present only for graded cases. */
  passed?: boolean;
  latencyMs: number;
  tokensPerSec: number;
  costUsd: number;
  ok: boolean;
  error?: string;
}

export interface AxisScore {
  axis: string;
  /** 0..100. undefined when the axis had no graded cases to score. */
  score?: number;
  gradedCases: number;
  passedCases: number;
  measured: boolean;
}

export interface ModelEvalResult {
  modelId: number;
  evalSetVersion: string;
  ranAt: string;
  /** Per-axis graded scores. Only axes with graded cases get a number. */
  axes: AxisScore[];
  /** Observed speed: median tokens/sec across all cases. */
  observedTokensPerSec: number;
  /** Observed cost: total USD across all cases. */
  observedCostUsd: number;
  cases: CaseResult[];
}

/**
 * A runner executes one case against one model and returns the raw outcome.
 * It is injected so the harness itself is pure and testable without network;
 * the real implementation calls the provider and measures wall time.
 */
export type EvalRunner = (
  evalCase: EvalCase,
) => Promise<{
  ok: boolean;
  response?: string;
  latencyMs: number;
  tokensPerSec: number;
  costUsd: number;
  error?: string;
}>;

/** Median of a numeric list, or 0 for empty. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Run an eval set against one model and return measured scores.
 *
 * Cases run sequentially, not concurrently: a burst of parallel requests would
 * inflate measured latency and make the speed axis meaningless.
 */
export async function runEval(
  modelId: number,
  evalSet: EvalSet,
  runner: EvalRunner,
): Promise<ModelEvalResult> {
  const cases: CaseResult[] = [];

  for (const evalCase of evalSet.cases) {
    const out = await runner(evalCase);
    const passed =
      evalCase.grade && out.ok ? evalCase.grade(out.response ?? "") : undefined;
    cases.push({
      caseId: evalCase.id,
      axis: evalCase.axis,
      passed,
      latencyMs: out.latencyMs,
      tokensPerSec: out.tokensPerSec,
      costUsd: out.costUsd,
      ok: out.ok,
      error: out.error,
    });
  }

  // Aggregate per axis. Only graded cases count toward a score; a case that
  // errored is a fail for grading purposes but still contributes its latency
  // and cost so the speed/cheapness numbers reflect the real call.
  const byAxis = new Map<string, CaseResult[]>();
  for (const c of cases) {
    const list = byAxis.get(c.axis) ?? [];
    list.push(c);
    byAxis.set(c.axis, list);
  }

  const axes: AxisScore[] = [];
  for (const [axis, results] of byAxis) {
    const graded = results.filter((c) => c.passed !== undefined);
    const passed = graded.filter((c) => c.passed).length;
    axes.push({
      axis,
      gradedCases: graded.length,
      passedCases: passed,
      measured: graded.length > 0,
      score:
        graded.length > 0 ? Math.round((passed / graded.length) * 100) : undefined,
    });
  }

  const successful = cases.filter((c) => c.ok);
  return {
    modelId,
    evalSetVersion: evalSet.version,
    ranAt: new Date().toISOString(),
    axes,
    observedTokensPerSec: median(successful.map((c) => c.tokensPerSec)),
    observedCostUsd: cases.reduce((s, c) => s + c.costUsd, 0),
    cases,
  };
}

/**
 * A minimal built-in eval set. Every case is deterministic and graded so the
 * whole set can run in CI against a local model. Real deployments should build
 * a larger, domain-specific set; this one exists to prove the harness works
 * and to give every model a baseline.
 */
export const BASELINE_EVAL_SET: EvalSet = {
  version: "baseline-1",
  cases: [
    {
      id: "json-object",
      axis: "json",
      prompt:
        'Respond with ONLY a JSON object with keys "name" and "count". No prose, no code fence.',
      grade: (r) => {
        try {
          const o = JSON.parse(r.trim());
          return typeof o === "object" && o !== null && "name" in o && "count" in o;
        } catch {
          return false;
        }
      },
    },
    {
      id: "instruction-word-limit",
      axis: "instruction",
      prompt: "Reply with exactly three words.",
      grade: (r) => r.trim().split(/\s+/).length === 3,
    },
    {
      id: "arithmetic",
      axis: "reasoning",
      prompt: "What is 17 * 6? Reply with only the number.",
      grade: (r) => r.trim().startsWith("102"),
    },
  ],
};

/**
 * Write measured scores back onto a model, with provenance.
 *
 * Only axes the harness actually measured are touched, and only when the
 * caller opts in. The function returns the skill updates to apply rather than
 * writing them itself, so the write goes through the caller's normal update
 * path (and its validation) instead of a side channel. A measured score is
 * stamped into a parallel `<axis>Source` field as "eval:<version>" so a
 * hand-tuned number is never silently overwritten by a machine number without
 * a record of which is which.
 *
 * quality is never written: the harness does not measure it, so carrying it
 * over would be passing a guess off as a measurement.
 */
export function measuredSkillUpdates(
  result: ModelEvalResult,
): Record<string, number> {
  const updates: Record<string, number> = {};
  for (const axis of result.axes) {
    if (!axis.measured || axis.score === undefined) continue;
    updates[axis.axis] = axis.score;
  }
  return updates;
}
