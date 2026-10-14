export interface EvalCase {
  id: string;
  axis: string;
  prompt: string;
  grade?: (response: string) => boolean;
}

export interface EvalSet {
  version: string;
  cases: EvalCase[];
}

export interface CaseResult {
  caseId: string;
  axis: string;
  passed?: boolean;
  latencyMs: number;
  tokensPerSec: number;
  costUsd: number;
  ok: boolean;
  error?: string;
}

export interface AxisScore {
  axis: string;
  score?: number;
  gradedCases: number;
  passedCases: number;
  measured: boolean;
}

export interface ModelEvalResult {
  modelId: number;
  evalSetVersion: string;
  ranAt: string;
  axes: AxisScore[];
  observedTokensPerSec: number;
  observedCostUsd: number;
  cases: CaseResult[];
}

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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

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
