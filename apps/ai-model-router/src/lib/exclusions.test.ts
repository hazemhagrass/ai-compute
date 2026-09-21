import { describe, expect, it } from "vitest";

import { rankModels } from "./engine";
import { explainExclusions } from "./exclusions";
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

/* ----------------------------------------------------- individual codes */

describe("explainExclusions — codes", () => {
  it("says nothing about a model that is eligible", () => {
    const report = explainExclusions([model()], { task: task() });

    expect(report.excluded).toEqual([]);
    expect(report.totalExcluded).toBe(0);
    expect(report.summary).toBe("no models excluded");
  });

  it("reports a disabled model", () => {
    const report = explainExclusions([model({ enabled: false, label: "Old Model" })], {
      task: task(),
    });

    expect(report.excluded[0].primary.code).toBe("disabled");
    expect(report.excluded[0].primary.message).toContain("Old Model");
    expect(report.excluded[0].primary.detail.enabled).toBe(false);
  });

  it("reports a provider that was not selected, naming the provider", () => {
    const other = model({ id: 2, providerId: 7, providerName: "Elsewhere" });

    const report = explainExclusions([other], { task: task(), providerIds: [1, 3] });

    const reason = report.excluded[0].primary;
    expect(reason.code).toBe("provider_disabled");
    expect(reason.message).toContain("Elsewhere");
    expect(reason.message).toContain("id 7");
    expect(reason.detail.providerId).toBe(7);
  });

  it("reports the real prices when a model is over budget", () => {
    const pricey = model({ outputCost: 60 });

    const report = explainExclusions([pricey], { task: task(), maxOutputCost: 10 });

    const reason = report.excluded[0].primary;
    expect(reason.code).toBe("over_budget");
    expect(reason.message).toBe("costs $60 per 1M output tokens, budget is $10");
    expect(reason.detail).toMatchObject({ outputCost: 60, maxOutputCost: 10 });
  });

  it("reports both context numbers, which is the point of the ticket", () => {
    const small = model({ contextWindow: 32_000 });

    const report = explainExclusions([small], {
      task: task({ requires: { minContext: 128_000 } }),
    });

    const reason = report.excluded[0].primary;
    expect(reason.code).toBe("context_too_small");
    expect(reason.message).toBe("needs 128k context, model has 32k");
    expect(reason.detail).toMatchObject({ required: 128_000, actual: 32_000 });
  });

  it("uses the stricter of the option ceiling and the task requirement, once", () => {
    const small = model({ contextWindow: 32_000 });

    const report = explainExclusions([small], {
      task: task({ requires: { minContext: 64_000 } }),
      minContext: 200_000,
    });

    const contextReasons = report.excluded[0].reasons.filter(
      (r) => r.code === "context_too_small",
    );
    expect(contextReasons).toHaveLength(1);
    expect(contextReasons[0].message).toBe("needs 200k context, model has 32k");
  });

  it("keeps a model whose context window is unrecorded rather than guessing", () => {
    // Mirrors rankModels: 0 means "unknown", not "zero tokens".
    const unknown = model({ contextWindow: 0 });

    const report = explainExclusions([unknown], {
      task: task({ requires: { minContext: 128_000 } }),
    });

    expect(report.excluded).toEqual([]);
  });

  it("names the specific missing capability", () => {
    const report = explainExclusions([model({ label: "Blind Model" })], {
      task: task({ requires: { vision: true } }),
    });

    const reason = report.excluded[0].primary;
    expect(reason.code).toBe("missing_capability");
    expect(reason.subject).toBe("vision");
    expect(reason.message).toContain("Blind Model");
    expect(reason.detail.capability).toBe("vision");
  });

  it("reports an embedding-only model on a normal task", () => {
    const embedding = model({
      label: "Embed v3",
      features: { ...model().features, embedding: true },
    });

    const report = explainExclusions([embedding], { task: task() });

    expect(report.excluded[0].primary.code).toBe("embedding_only");
  });

  it("reports a non-embedding model on an embedding task", () => {
    const report = explainExclusions([model()], {
      task: task({ requires: { embedding: true } }),
    });

    const reason = report.excluded[0].primary;
    expect(reason.code).toBe("missing_capability");
    expect(reason.subject).toBe("embeddings");
  });
});

/* -------------------------------------------------------- many reasons */

describe("explainExclusions — multiple reasons", () => {
  it("reports every failure, not just the first", () => {
    // Deliberate: fixing only the first reason would leave the user re-running
    // the router to discover the next one.
    const bad = model({
      enabled: false,
      outputCost: 90,
      contextWindow: 8_000,
      features: { ...model().features, vision: false, tools: false },
    });

    const report = explainExclusions([bad], {
      task: task({ requires: { vision: true, tools: true, minContext: 128_000 } }),
      maxOutputCost: 10,
    });

    const codes = report.excluded[0].reasons.map((r) => r.code);
    expect(codes).toEqual([
      "disabled",
      "over_budget",
      "context_too_small",
      "missing_capability",
      "missing_capability",
    ]);
    expect(report.excluded[0].reasons.map((r) => r.subject)).toContain("vision");
  });

  it("uses the first reason in filter order as the primary", () => {
    const bad = model({ enabled: false, outputCost: 90 });

    const report = explainExclusions([bad], { task: task(), maxOutputCost: 10 });

    expect(report.excluded[0].primary.code).toBe("disabled");
    expect(report.excluded[0].reasons).toHaveLength(2);
  });

  it("counts a multi-reason model exactly once", () => {
    const bad = model({ enabled: false, outputCost: 90 });

    const report = explainExclusions([bad], { task: task(), maxOutputCost: 10 });

    expect(report.totalExcluded).toBe(1);
    expect(report.groups.reduce((s, g) => s + g.count, 0)).toBe(1);
  });
});

/* ------------------------------------------------------------ grouping */

describe("explainExclusions — grouping", () => {
  it("produces the headline sentence with correct counts", () => {
    const models = [
      ...Array.from({ length: 8 }, (_, i) => model({ id: i + 1, outputCost: 99 })),
      ...Array.from({ length: 4 }, (_, i) => model({ id: i + 20 })),
    ];

    const report = explainExclusions(models, {
      task: task({ requires: { vision: true } }),
      maxOutputCost: 10,
    });

    expect(report.totalExcluded).toBe(12);
    expect(report.summary).toBe("excluded 12 models: 8 over budget, 4 missing vision");
  });

  it("sorts groups largest first", () => {
    const models = [
      model({ id: 1, enabled: false }),
      model({ id: 2, outputCost: 99 }),
      model({ id: 3, outputCost: 99 }),
      model({ id: 4, outputCost: 99 }),
    ];

    const report = explainExclusions(models, { task: task(), maxOutputCost: 10 });

    expect(report.groups.map((g) => g.label)).toEqual(["over budget", "disabled"]);
    expect(report.groups[0].modelIds).toEqual([2, 3, 4]);
  });

  it("keeps different missing capabilities in separate buckets", () => {
    const noVision = model({ id: 1, features: { ...model().features, vision: false } });
    const noTools = model({
      id: 2,
      features: { ...model().features, vision: true, tools: false },
    });

    const report = explainExclusions([noVision, noTools], {
      task: task({ requires: { vision: true, tools: true } }),
    });

    expect(report.groups.map((g) => g.label).sort()).toEqual([
      "missing tool calling",
      "missing vision",
    ]);
  });

  it("uses the singular form for a single excluded model", () => {
    const report = explainExclusions([model({ enabled: false })], { task: task() });

    expect(report.summary).toBe("excluded 1 model: 1 disabled");
  });
});

/* --------------------------------------------------------- edge cases */

describe("explainExclusions — edges", () => {
  it("handles an empty candidate list", () => {
    const report = explainExclusions([], { task: task() });

    expect(report).toEqual({
      excluded: [],
      groups: [],
      totalExcluded: 0,
      summary: "no models excluded",
    });
  });

  it("excludes nothing when no constraints are set", () => {
    const models = [model({ id: 1 }), model({ id: 2 }), model({ id: 3 })];

    expect(explainExclusions(models, { task: task() }).totalExcluded).toBe(0);
  });

  it("ignores an empty providerIds list, matching rankModels", () => {
    const report = explainExclusions([model()], { task: task(), providerIds: [] });

    expect(report.excluded).toEqual([]);
  });

  it("formats a fractional budget without losing cents", () => {
    const report = explainExclusions([model({ outputCost: 1.25 })], {
      task: task(),
      maxOutputCost: 0.5,
    });

    expect(report.excluded[0].primary.message).toBe(
      "costs $1.25 per 1M output tokens, budget is $0.50",
    );
  });
});

/* -------------------------------------------- agreement with the ranker */

describe("explainExclusions — agrees with rankModels", () => {
  it("explains exactly the models the ranker dropped", () => {
    const models = [
      model({ id: 1 }),
      model({ id: 2, enabled: false }),
      model({ id: 3, outputCost: 99 }),
      model({ id: 4, contextWindow: 1_000 }),
      model({ id: 5, features: { ...model().features, embedding: true } }),
      model({ id: 6, providerId: 9 }),
    ];
    const criteria = {
      task: task({ requires: { minContext: 32_000 } }),
      maxOutputCost: 10,
      providerIds: [1],
    };

    const ranked = rankModels(criteria.task, models, criteria);
    const report = explainExclusions(models, criteria);

    const rankedIds = ranked.map((r) => r.model.id).sort();
    const excludedIds = report.excluded.map((e) => e.modelId).sort();

    expect(rankedIds).toEqual([1]);
    expect(excludedIds).toEqual([2, 3, 4, 5, 6]);
    expect(rankedIds.length + excludedIds.length).toBe(models.length);
  });
});
