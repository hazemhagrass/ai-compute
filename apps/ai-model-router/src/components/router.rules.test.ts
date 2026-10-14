import { describe, expect, it } from "vitest";

import {
  buildRecommendationBody,
  relativeScoreWidth,
  resolveActiveTask,
  resultsTitle,
  weightSummary,
  type RouterDraft,
} from "./router.rules";

const BASE_DRAFT: RouterDraft = {
  mode: "preset",
  taskId: 7,
  text: "",
  weights: {},
  localOnly: false,
  useAi: false,
  maxOutputCost: "",
  minContext: "",
  selectedProviders: [],
};

describe("buildRecommendationBody", () => {
  it("preset mode requires a task id", () => {
    const out = buildRecommendationBody({ ...BASE_DRAFT, taskId: null });
    expect(out).toEqual({ ok: false, error: "Pick a task first" });
  });

  it("preset mode sends the task id", () => {
    const out = buildRecommendationBody(BASE_DRAFT);
    expect(out.ok).toBe(true);
    expect((out as { body: { taskId?: number } }).body.taskId).toBe(7);
  });

  it("describe mode requires non-empty text", () => {
    const out = buildRecommendationBody({ ...BASE_DRAFT, mode: "describe" });
    expect(out).toEqual({ ok: false, error: "Describe what you need" });
  });

  it("describe sends the description text", () => {
    const out = buildRecommendationBody({
      ...BASE_DRAFT,
      mode: "describe",
      text: "code review",
    });
    expect(out.ok).toEqual(true);
    expect((out as { body: { text?: string } }).body.text).toBe("code review");
  });

  it("manual mode requires at least one non-zero weight", () => {
    const out = buildRecommendationBody({ ...BASE_DRAFT, mode: "manual" });
    expect(out).toEqual({ ok: false, error: "Set at least one priority slider" });
  });

  it("manual mode sends only the non-zero override weights", () => {
    const out = buildRecommendationBody({
      ...BASE_DRAFT,
      mode: "manual",
      weights: { coding: 4, reasoning: 0, speed: 2 },
    });
    expect(out.ok).toBe(true);
    expect((out as { body: { overrideWeights?: object } }).body.overrideWeights).toEqual({
      coding: 4,
      speed: 2,
    });
  });

  it("carries optional constraints only when set", () => {
    const out = buildRecommendationBody({
      ...BASE_DRAFT,
      maxOutputCost: "3.5",
      minContext: "128",
      selectedProviders: [1, 2],
    });
    const body = (out as { body: Record<string, unknown> }).body;
    expect(body.maxOutputCost).toBe(3.5);
    expect(body.minContext).toBe(128_000);
    expect(body.providerIds).toEqual([1, 2]);
  });

  it("omits unset optional constraints", () => {
    const body = (buildRecommendationBody(BASE_DRAFT) as { body: Record<string, unknown> })
      .body;
    expect(body).not.toHaveProperty("maxOutputCost");
    expect(body).not.toHaveProperty("minContext");
    expect(body).not.toHaveProperty("providerIds");
  });
});

describe("weightSummary", () => {
  it("sorts descending and formats as axis×value", () => {
    expect(weightSummary({ speed: 2, quality: 5, cheapness: 3 })).toBe(
      "quality×5  ·  cheapness×3  ·  speed×2",
    );
  });

  it("falls back for empty weights", () => {
    expect(weightSummary({})).toBe("no weights");
  });
});

describe("relativeScoreWidth", () => 	{
  it("normalizes against the best score", () => {
    expect(relativeScoreWidth(50, 100)).toBe(50);
    expect(relativeScoreWidth(100, 100)).toBe(100);
  });

  it("clamps to a 3% floor so last place stays visible", () => {
    expect(relativeScoreWidth(1, 100)).toBe(3);
  });

  it("guards a non-positive best", () => {
    expect(relativeScoreWidth(10, 0)).toBe(3);
  });
});

describe("resolveActiveTask / resultsTitle", () => {
  const tasks = [
    { id: 1, label: "Code review" },
    { id: 2, label: "Summarize docs" },
  ] as unknown as Parameters<typeof resolveActiveTask>[0];

  it("finds the active task", () => {
    expect(resolveActiveTask(tasks, 2)?.label).toBe("Summarize docs");
  });

  it("returns null for an unknown id", () => {
    expect(resolveActiveTask(tasks, 99)).toBeNull();
  });

  it("resultsTitle is null before any run", () => {
    expect(resultsTitle(null)).toBeNull();
  });

  it("resultsTitle names the winning task", () => {
    const rec = { task: { label: "Code review" } } as unknown as Parameters<
      typeof resultsTitle>[0];
    expect(resultsTitle(rec)).toBe("Ranked for: Code review");
  });
});
