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
    providers: {
      "fixture-provider": { name: "Fixture" },
      "other-provider": { name: "Other" },
      "good-provider": { name: "Good" },
      "bad-provider": { name: "Bad" },
      "third-provider": { name: "Third" },
    },
    ...extra,
  });
}

describe("validatePoolEntries", () => {
  it("accepts a known model on a configured provider", () => {
    const outcome = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "fixture-provider", model: "fixture-chat-model" }],
      configWithProviders(),
      catalog,
    );
    expect(outcome).toEqual({ errors: [], warnings: [] });
  });

  it("matches a known model by label too", () => {
    const outcome = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "other-provider", model: "Fixture Chat Model" }],
      configWithProviders(),
      catalog,
    );
    expect(outcome).toEqual({ errors: [], warnings: [] });
  });

  it("rejects an unknown provider with the tier name and pool index", () => {
    const outcome = validatePoolEntries(
      "complex",
      "pool",
      [
        { provider: "fixture-provider", model: "fixture-chat-model" },
        { provider: "ghost-provider", model: "fixture-chat-model" },
      ],
      configWithProviders(),
      catalog,
    );
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]).toMatchObject({
      tier: "complex",
      index: 1,
      field: "provider",
    });
    expect(outcome.errors[0].message).toContain("ghost-provider");
    expect(outcome.warnings).toEqual([]);
  });

  it("warns instead of erroring on a model missing from the router model catalog", () => {
    const outcome = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "fixture-provider", model: "hallucinated-model" }],
      configWithProviders(),
      catalog,
    );
    expect(outcome.errors).toEqual([]);
    expect(outcome.warnings).toHaveLength(1);
    expect(outcome.warnings[0]).toMatchObject({ tier: "normal", index: 0, field: "model" });
    expect(outcome.warnings[0].message).toContain("not in the router model catalog");
  });

  it("rejects an embedding-only model with the exclusion-transparency reason", () => {
    const outcome = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "fixture-provider", model: "fixture-embed" }],
      configWithProviders(),
      catalog,
    );
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]).toMatchObject({ tier: "normal", index: 0, field: "model" });
    expect(outcome.errors[0].message).toContain("embedding-only");
  });

  it("rejects a disabled model with the exclusion-transparency reason", () => {
    const outcome = validatePoolEntries(
      "normal",
      "fallback",
      [{ provider: "fixture-provider", model: "fixture-disabled" }],
      configWithProviders(),
      catalog,
    );
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]).toMatchObject({ tier: "normal", index: 0, field: "model", list: "fallback" });
    expect(outcome.errors[0].message).toContain("disabled");
  });

  it("reports provider errors and model warnings for the same row separately", () => {
    const outcome = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "ghost-provider", model: "hallucinated-model" }],
      configWithProviders(),
      catalog,
    );
    expect(outcome.errors.map((e) => e.field)).toEqual(["provider"]);
    expect(outcome.warnings.map((w) => w.field)).toEqual(["model"]);
    expect(
      [...outcome.errors, ...outcome.warnings].every((e) => e.index === 0 && e.tier === "normal"),
    ).toBe(true);
  });

  it("prefers a catalog match whose provider owns the model id", () => {
    const sharedCatalog: ModelCatalog = {
      models: [
        model({
          id: 10,
          providerSlug: "good-provider",
          providerName: "Good Provider",
          modelId: "shared-model",
          label: "Shared Model",
        }),
        model({
          id: 11,
          providerSlug: "bad-provider",
          providerName: "Bad Provider",
          modelId: "shared-model",
          label: "Shared Model",
          enabled: false,
        }),
      ],
    };

    const good = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "good-provider", model: "shared-model" }],
      configWithProviders(),
      sharedCatalog,
    );
    expect(good).toEqual({ errors: [], warnings: [] });

    const bad = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "bad-provider", model: "shared-model" }],
      configWithProviders(),
      sharedCatalog,
    );
    expect(bad.errors).toHaveLength(1);
    expect(bad.errors[0].message).toContain("disabled");

    const unowned = validatePoolEntries(
      "normal",
      "pool",
      [{ provider: "third-provider", model: "shared-model" }],
      configWithProviders(),
      sharedCatalog,
    );
    expect(unowned).toEqual({ errors: [], warnings: [] });
  });
});

describe("validateWrittenEntries", () => {
  function tierConfig(tiers: Record<string, unknown>): HermesConfig {
    return configWithProviders({ tier_router: { tiers, classifier: { pool: [] } } });
  }

  const legacyRow = { provider: "fixture-provider", model: "legacy-local-tag" };

  it("validates only the edited tier, so a broken unrelated tier never blocks", () => {
    const before = tierConfig({
      broken: { pool: [{ provider: "ghost-provider", model: "hallucinated-model" }], fallback: [] },
      normal: { pool: [{ provider: "fixture-provider", model: "fixture-chat-model" }], fallback: [] },
    });
    const after = tierConfig({
      broken: { pool: [{ provider: "ghost-provider", model: "hallucinated-model" }], fallback: [] },
      normal: {
        mode: "priority",
        pool: [{ provider: "fixture-provider", model: "fixture-chat-model" }],
        fallback: [],
      },
    });

    const outcome = validateWrittenEntries(before, after, { kind: "tier", name: "normal" }, catalog);
    expect(outcome).toEqual({ errors: [], warnings: [] });
  });

  it("never flags an unchanged off-catalog row in the edited tier", () => {
    const before = tierConfig({ legacy: { mode: "priority", pool: [legacyRow], fallback: [] } });
    const after = tierConfig({
      legacy: { mode: "round_robin", escalate_to: "normal", pool: [legacyRow], fallback: [] },
    });

    const outcome = validateWrittenEntries(before, after, { kind: "tier", name: "legacy" }, catalog);
    expect(outcome).toEqual({ errors: [], warnings: [] });
  });

  it("warns on a new off-catalog row but does not error", () => {
    const before = tierConfig({ normal: { pool: [{ provider: "fixture-provider", model: "fixture-chat-model" }], fallback: [] } });
    const after = tierConfig({
      normal: {
        pool: [
          { provider: "fixture-provider", model: "fixture-chat-model" },
          legacyRow,
        ],
        fallback: [],
      },
    });

    const outcome = validateWrittenEntries(before, after, { kind: "tier", name: "normal" }, catalog);
    expect(outcome.errors).toEqual([]);
    expect(outcome.warnings).toEqual([
      expect.objectContaining({ tier: "normal", index: 1, field: "model", list: "pool" }),
    ]);
  });

  it("errors on a new row with an unknown provider", () => {
    const before = tierConfig({ normal: { pool: [{ provider: "fixture-provider", model: "fixture-chat-model" }], fallback: [] } });
    const after = tierConfig({
      normal: {
        pool: [
          { provider: "fixture-provider", model: "fixture-chat-model" },
          { provider: "ghost-provider", model: "fixture-chat-model" },
        ],
        fallback: [],
      },
    });

    const outcome = validateWrittenEntries(before, after, { kind: "tier", name: "normal" }, catalog);
    expect(outcome.errors).toEqual([
      expect.objectContaining({ tier: "normal", index: 1, field: "provider" }),
    ]);
  });

  it("validates a changed row even when provider and model are unchanged", () => {
    const before = tierConfig({ legacy: { pool: [legacyRow], fallback: [] } });
    const after = tierConfig({
      legacy: { pool: [{ ...legacyRow, base_url: "http://localhost:11434" }], fallback: [] },
    });

    const outcome = validateWrittenEntries(before, after, { kind: "tier", name: "legacy" }, catalog);
    expect(outcome.errors).toEqual([]);
    expect(outcome.warnings).toEqual([
      expect.objectContaining({ tier: "legacy", index: 0, field: "model" }),
    ]);
  });

  it("validates the classifier pool under the classifier label", () => {
    const before = configWithProviders({ tier_router: { tiers: {}, classifier: { pool: [] } } });
    const after = configWithProviders({
      tier_router: {
        tiers: {},
        classifier: { pool: [{ provider: "ghost-provider", model: "fixture-chat-model" }] },
      },
    });

    const outcome = validateWrittenEntries(before, after, { kind: "classifier" }, catalog);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]).toMatchObject({ tier: "classifier", index: 0, field: "provider", list: "pool" });
    expect(outcome.warnings).toEqual([]);
  });

  it("validates nothing when there is no pool target", () => {
    const before = tierConfig({ broken: { pool: [{ provider: "ghost-provider", model: "hallucinated-model" }], fallback: [] } });
    const outcome = validateWrittenEntries(before, before, null, catalog);
    expect(outcome).toEqual({ errors: [], warnings: [] });
  });
});
