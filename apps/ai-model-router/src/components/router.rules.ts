import type { Recommendation, Task } from "@/lib/types";

export type RouterMode = "preset" | "describe" | "manual";

export interface RouterDraft {
  mode: RouterMode;
  taskId: number | null;
  text: string;
  weights: Record<string, number>;
  localOnly: boolean;
  useAi: boolean;
  maxOutputCost: string;
  minContext: string;
  selectedProviders: number[];
}

export type BuildBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

export function buildRecommendationBody(draft: RouterDraft): BuildBodyResult {
  const body: Record<string, unknown> = {
    localOnly: draft.localOnly,
    useAi: draft.useAi,
    limit: 8,
  };

  if (draft.mode === "preset") {
    if (!draft.taskId) return { ok: false, error: "Pick a task first" };
    body.taskId = draft.taskId;
  } else if (draft.mode === "describe") {
    if (!draft.text.trim()) return { ok: false, error: "Describe what you need" };
    body.text = draft.text;
  } else {
    const active = Object.entries(draft.weights).filter(([, v]) => v > 0);
    if (!active.length) {
      return { ok: false, error: "Set at least one priority slider" };
    }
    body.text = "Manual priority selection";
    body.overrideWeights = Object.fromEntries(active);
  }

  if (Object.keys(draft.weights).length && draft.mode !== "manual") {
    body.overrideWeights = draft.weights;
  }
  if (draft.selectedProviders.length) body.providerIds = draft.selectedProviders;
  if (draft.maxOutputCost) body.maxOutputCost = Number(draft.maxOutputCost);
  if (draft.minContext) body.minContext = Number(draft.minContext) * 1000;

  return { ok: true, body };
}

export function weightSummary(weights: Record<string, number>): string {
  return (
    Object.entries(weights)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}×${v}`)
      .join("  ·  ") || "no weights"
  );
}

export function relativeScoreWidth(score: number, best: number): number {
  if (best <= 0) return 3;
  return Math.max(3, (score / best) * 100);
}

export function resolveActiveTask(
  tasks: Task[],
  taskId: number | null,
): Task | null {
  return tasks.find((t) => t.id === taskId) ?? null;
}

export function resultsTitle(rec: Recommendation | null): string | null {
  if (!rec) return null;
  return `Ranked for: ${rec.task.label}`;
}
