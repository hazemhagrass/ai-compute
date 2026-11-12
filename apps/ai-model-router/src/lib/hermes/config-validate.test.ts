import { describe, expect, it } from "vitest";

import type { Model } from "../types";
import { parseHermesConfig, type HermesConfig } from "./config-schema";
import {
  validatePoolEntries,
  validateWrittenEntries,
  type ModelCatalog,
} from "./config-validate";

function model(overrides: Partial<Model> = {}): Model {
  return {
    id: 1,
    providerId: 1,
    providerSlug: "fixture-provider",
    providerName: "Fixture Provider",
    modelId: "fixture-chat-model",
    label: "Fixture Chat Model",
    quality: 60,
    speed: 60,
    cheapness: 60,
    contextWindow: 128000,
    maxOutput: 8192,
    inputCost: 1,
    outputCost: 2,
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
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const catalog: ModelCatalog = {
  models: [
    model(),
    model({ id: 2, modelId: "fixture-embed", label: "Fixture Embed", features: { ...model().features, embedding: true } }),
    model({ id: 3, modelId: "fixture-disabled", label: "Fixture Disabled", enabled: false }),
  ],
};

function configWithProviders(extra: Record<string, unknown> = {}): HermesConfig {
  return parseHermesConfig({
    providers: { "fixture-provider": { name: "Fixture" }, "other-provider": { name: "Other" } },
    ...extra,
  });
}

describe("validatePoolEntries", () => {
  it("accepts a known model on a configured provider", () => {
    const errors = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "fixture-provider", model: "fixture-chat-model" }],
      configWithProviders(),
      catalog,
    );
    expect(errors).toEqual([]);
  });

  it("matches a known model by label too", () => {
    const errors = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "other-provider", model: "Fixture Chat Model" }],
      configWithProviders(),
      catalog,
    );
    expect(errors).toEqual([]);
  });

  it("rejects an unknown provider with the tier name and pool index", () => {
    const errors = validatePoolEntries(
      "complex",
      "pool",
      [
        { provider: "fixture-provider", model: "fixture-chat-model" },
        { provider: "ghost-provider", model: "fixture-chat-model" },
      ],
      configWithProviders(),
      catalog,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      tier: "complex",
      index: 1,
      field: "provider",
    });
    expect(errors[0].message).toContain("ghost-provider");
  });

  it("rejects a model missing from the router model catalog", () => {
    const errors = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "fixture-provider", model: "hallucinated-model" }],
      configWithProviders(),
      catalog,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ tier: "normal", index: 0, field: "model" });
    expect(errors[0].message).toContain("not in the router model catalog");
  });

  it("rejects an embedding-only model with the exclusion-transparency reason", () => {
    const errors = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "fixture-provider", model: "fixture-embed" }],
      configWithProviders(),
      catalog,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ tier: "normal", index: 0, field: "model" });
    expect(errors[0].message).toContain("embedding-only");
  });

  it("rejects a disabled model with the exclusion-transparency reason", () => {
    const errors = validatePoolEntries(
      "normal",
      "fallback",
      [{ provider: "fixture-provider", model: "fixture-disabled" }],
      configWithProviders(),
      catalog,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ tier: "normal", index: 0, field: "model", list: "fallback" });
    expect(errors[0].message).toContain("disabled");
  });

  it("reports provider and model problems for the same row separately", () => {
    const errors = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "ghost-provider", model: "hallucinated-model" }],
      configWithProviders(),
      catalog,
    );
    expect(errors.map((e) => e.field).sort()).toEqual(["model", "provider"]);
    expect(errors.every((e) => e.index === 0 && e.tier === "normal")).toBe(true);
  });
});

describe("validateWrittenEntries", () => {
  it("validates only the edited tier, so a broken unrelated tier never blocks", () => {
    const config = parseHermesConfig({
      providers: { "fixture-provider": { name: "Fixture" } },
      tier_router: {
        tiers: {
          broken: { pool: [{ provider: "ghost-provider", model: "hallucinated-model" }], fallback: [] },
          normal: { pool: [{ provider: "fixture-provider", model: "fixture-chat-model" }], fallback: [] },
        },
      },
    });

    const errors = validateWrittenEntries(config, { kind: "tier", name: "normal" }, catalog);
    expect(errors).toEqual([]);
  });

  it("validates the classifier pool under the classifier label", () => {
    const config = parseHermesConfig({
      providers: { "fixture-provider": { name: "Fixture" } },
      tier_router: {
        classifier: { pool: [{ provider: "ghost-provider", model: "fixture-chat-model" }] },
        tiers: {},
      },
    });

    const errors = validateWrittenEntries(config, { kind: "classifier" }, catalog);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ tier: "classifier", index: 0, field: "provider", list: "pool" });
  });

  it("validates nothing when there is no pool target", () => {
    const config = parseHermesConfig({
      providers: {},
      tier_router: {
        tiers: {
          broken: { pool: [{ provider: "ghost-provider", model: "hallucinated-model" }], fallback: [] },
        },
      },
    });
    expect(validateWrittenEntries(config, null, catalog)).toEqual([]);
  });
});
