import { describe, expect, it } from "vitest";

import { rankModels, taskFromText } from "./engine";
import type { Model, Task } from "./types";

/* ------------------------------------------------------------- fixtures */

function model(over: Partial<Model> = {}): Model {
  return {
    id: 1,
    providerId: 1,
    providerSlug: "test",
    providerName: "Test",
    modelId: "test-model",
    label: "Test Model",
    quality: 70,
    speed: 70,
    cheapness: 70,
    contextWindow: 128_000,
    maxOutput: 8_000,
    inputCost: 1,
    outputCost: 5,
    skills: {},
    features: {
      tools: true,
      vision: false,
      json: true,
      streaming: true,
      reasoning: false,
      audio: false,
      embedding: false,
    },
    tags: [],
    notes: "",
    enabled: true,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: 1,
    slug: "t",
    label: "T",
    description: "",
    weights: { coding: 1 },
    requires: {},
    pinnedModelId: null,
    builtin: false,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

/* ------------------------------------------------------- hard filtering */

describe("rankModels — hard requirements", () => {
  it("drops a model that lacks a required capability", () => {
    const withVision = model({ id: 1, features: { ...model().features, vision: true } });
    const without = model({ id: 2 });

    const ranked = rankModels(task({ requires: { vision: true } }), [withVision, without]);

    expect(ranked.map((r) => r.model.id)).toEqual([1]);
  });

  it("excludes embedding models from non-embedding tasks", () => {
    // The non-obvious half of the rule: an embedding model would otherwise
    // score well on a text task it physically cannot perform.
    const embedding = model({
      id: 2,
      features: { ...model().features, embedding: true },
    });

    const ranked = rankModels(task(), [model({ id: 1 }), embedding]);

    expect(ranked.map((r) => r.model.id)).toEqual([1]);
  });

  it("excludes non-embedding models from an embedding task", () => {
    const embedding = model({
      id: 2,
      features: { ...model().features, embedding: true },
    });

    const ranked = rankModels(
      task({ requires: { embedding: true } }),
      [model({ id: 1 }), embedding],
    );

    expect(ranked.map((r) => r.model.id)).toEqual([2]);
  });

  it("drops a model whose context window is below the minimum", () => {
    const small = model({ id: 1, contextWindow: 8_000 });
    const big = model({ id: 2, contextWindow: 200_000 });

    const ranked = rankModels(task({ requires: { minContext: 100_000 } }), [small, big]);

    expect(ranked.map((r) => r.model.id)).toEqual([2]);
  });

  it("keeps a model whose context window is unknown rather than guessing", () => {
    // 0 means "not recorded". Treating it as 0 tokens would silently hide every
    // freshly imported model from every long-context task.
    const unknown = model({ id: 1, contextWindow: 0 });

    const ranked = rankModels(task({ requires: { minContext: 100_000 } }), [unknown]);

    expect(ranked).toHaveLength(1);
  });

  it("skips disabled models", () => {
    const ranked = rankModels(task(), [model({ id: 1, enabled: false })]);
    expect(ranked).toEqual([]);
  });
});

/* -------------------------------------------------------------- scoring */

describe("rankModels — scoring", () => {
  it("falls back to discounted quality for an axis the model does not score", () => {
    // Must not be 0, or a sparsely-scored model is silently disqualified.
    const sparse = model({ quality: 100, skills: {} });

    const [scored] = rankModels(task({ weights: { coding: 1 } }), [sparse]);

    expect(scored.score).toBeCloseTo(70, 5); // 100 * 0.7
  });

  it("prefers an explicit skill score over the quality fallback", () => {
    const explicit = model({ quality: 100, skills: { coding: 20 } });

    const [scored] = rankModels(task({ weights: { coding: 1 } }), [explicit]);

    expect(scored.score).toBeCloseTo(20, 5);
  });

  it("computes a weighted mean, not a weighted sum", () => {
    // A sum would exceed 100 as weights grow and make scores incomparable
    // between tasks that happen to use different weight totals.
    const m = model({ skills: { coding: 90, creative: 30 } });

    const [scored] = rankModels(task({ weights: { coding: 3, creative: 1 } }), [m]);

    expect(scored.score).toBeCloseTo((90 * 3 + 30 * 1) / 4, 5);
    expect(scored.score).toBeLessThanOrEqual(100);
  });

  it("is independent of weight declaration order", () => {
    const m = model({ skills: { coding: 90, creative: 30 } });

    const [a] = rankModels(task({ weights: { coding: 3, creative: 1 } }), [m]);
    const [b] = rankModels(task({ weights: { creative: 1, coding: 3 } }), [m]);

    expect(a.score).toBeCloseTo(b.score, 10);
  });

  it("ignores zero-weight axes entirely", () => {
    const m = model({ skills: { coding: 90, creative: 0 } });

    const [withZero] = rankModels(
      task({ weights: { coding: 1, creative: 0 } }),
      [m],
    );
    const [without] = rankModels(task({ weights: { coding: 1 } }), [m]);

    expect(withZero.score).toBeCloseTo(without.score, 10);
  });

  it("derives longContext from the window when no explicit score exists", () => {
    const small = model({ id: 1, contextWindow: 8_000 });
    const huge = model({ id: 2, contextWindow: 2_000_000 });

    const ranked = rankModels(task({ weights: { longContext: 5 } }), [small, huge]);

    expect(ranked[0].model.id).toBe(2);
  });

  it("returns a breakdown that sums to the score", () => {
    const m = model({ skills: { coding: 90, reasoning: 40 } });

    const [scored] = rankModels(task({ weights: { coding: 2, reasoning: 1 } }), [m]);
    const summed = scored.breakdown.reduce((s, b) => s + b.points, 0);

    expect(summed).toBeCloseTo(scored.score, 10);
  });
});

/* ------------------------------------------------------------ overrides */

describe("rankModels — pins and constraints", () => {
  it("surfaces a pinned model first even when it scores lower", () => {
    const weak = model({ id: 1, skills: { coding: 10 } });
    const strong = model({ id: 2, skills: { coding: 99 } });

    const ranked = rankModels(
      task({ weights: { coding: 1 }, pinnedModelId: 1 }),
      [weak, strong],
    );

    expect(ranked[0].model.id).toBe(1);
    expect(ranked[0].pinned).toBe(true);
    expect(ranked[0].reasons[0]).toMatch(/pinned/i);
  });

  it("honours ignorePin so the raw ranking stays inspectable", () => {
    const weak = model({ id: 1, skills: { coding: 10 } });
    const strong = model({ id: 2, skills: { coding: 99 } });

    const ranked = rankModels(
      task({ weights: { coding: 1 }, pinnedModelId: 1 }),
      [weak, strong],
      { ignorePin: true },
    );

    expect(ranked[0].model.id).toBe(2);
  });

  it("flags an already-winning pinned model without reordering", () => {
    const strong = model({ id: 1, skills: { coding: 99 } });
    const weak = model({ id: 2, skills: { coding: 10 } });

    const ranked = rankModels(
      task({ weights: { coding: 1 }, pinnedModelId: 1 }),
      [strong, weak],
    );

    expect(ranked[0].model.id).toBe(1);
    expect(ranked[0].pinned).toBe(true);
  });

  it("applies a hard output-cost ceiling", () => {
    const cheap = model({ id: 1, outputCost: 2 });
    const pricey = model({ id: 2, outputCost: 60 });

    const ranked = rankModels(task(), [cheap, pricey], { maxOutputCost: 10 });

    expect(ranked.map((r) => r.model.id)).toEqual([1]);
  });

  it("restricts to the given providers", () => {
    const a = model({ id: 1, providerId: 1 });
    const b = model({ id: 2, providerId: 2 });

    const ranked = rankModels(task(), [a, b], { providerIds: [2] });

    expect(ranked.map((r) => r.model.id)).toEqual([2]);
  });

  it("respects the result limit", () => {
    const models = Array.from({ length: 10 }, (_, i) => model({ id: i + 1 }));

    expect(rankModels(task(), models, { limit: 3 })).toHaveLength(3);
  });
});

/* ------------------------------------------------------ text inference */

describe("taskFromText", () => {
  it("maps a debugging request onto debugging, context, and cost axes", () => {
    const t = taskFromText("debug a huge Rust stack trace cheaply");

    expect(t.weights.debugging).toBeGreaterThan(0);
    expect(t.weights.longContext).toBeGreaterThan(0);
    expect(t.weights.cheapness).toBeGreaterThan(0);
  });

  it("requires vision when the request is about images", () => {
    const t = taskFromText("read this screenshot and describe the chart");

    expect(t.requires.vision).toBe(true);
  });

  it("requires tool calling for agentic work", () => {
    const t = taskFromText("an autonomous agent that calls tools in a loop");

    expect(t.requires.tools).toBe(true);
  });

  it("requires JSON mode when structured output is asked for", () => {
    const t = taskFromText("extract structured json from these invoices");

    expect(t.requires.json).toBe(true);
  });

  it("falls back to general-purpose weights for unmatched text", () => {
    // Must never return an empty weight set: that would make every model
    // score identically and the ranking meaningless.
    const t = taskFromText("zzzzz qqqqq");

    expect(Object.keys(t.weights).length).toBeGreaterThan(0);
    expect(t.weights.quality).toBeGreaterThan(0);
  });

  it("caps any single axis at 5 so one keyword cannot dominate", () => {
    const t = taskFromText("code code code implement write build program refactor feature");

    for (const w of Object.values(t.weights)) expect(w).toBeLessThanOrEqual(5);
  });
});
