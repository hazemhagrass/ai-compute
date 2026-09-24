/** Tests for engine entitlement + localness + fallback (issues #154, #157). */
import { describe, expect, it } from "vitest";

import { rankModels, type RankProvider } from "./engine";
import type { Model, Task } from "./types";

function mkModel(over: Partial<Model> = {}): Model {
  return {
    id: 1,
    providerId: 1,
    providerSlug: "openai",
    providerName: "OpenAI",
    modelId: "gpt-4o",
    label: "GPT-4o",
    quality: 90,
    speed: 80,
    cheapness: 40,
    contextWindow: 128000,
    maxOutput: 4096,
    inputCost: 5,
    outputCost: 15,
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

function mkTask(over: Partial<Task> = {}): Task {
  return {
    id: 1,
    slug: "chat",
    label: "Chat",
    description: "",
    weights: { quality: 1 },
    requires: {},
    pinnedModelId: null,
    builtin: false,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

const cloudOpen: RankProvider = { id: 1, kind: "cloud", enabled: true };
const localOllama: RankProvider = { id: 2, kind: "local", enabled: true };
const providers = new Map([
  [cloudOpen.id, cloudOpen],
  [localOllama.id, localOllama],
]);

describe("engine entitlement filter (#154)", () => {
  it("keeps a model when the entitlement check allows it", () => {
    const m = mkModel();
    const result = rankModels(mkTask(), [m], {
      providers,
      checkEntitlement: () => ({ allowed: true }),
    });
    expect(result).toHaveLength(1);
  });

  it("drops a model when the check denies it", () => {
    const m = mkModel();
    const result = rankModels(mkTask(), [m], {
      providers,
      checkEntitlement: () => ({ allowed: false, reason: "no-subscription" }),
    });
    expect(result).toHaveLength(0);
  });

  it("passes the provider's enabled flag through to the check", () => {
    const m = mkModel();
    let seenEnabled: boolean | undefined;
    rankModels(mkTask(), [m], {
      providers: new Map([[1, { id: 1, kind: "cloud", enabled: false }]]),
      checkEntitlement: (_pid, providerEnabled) => {
        seenEnabled = providerEnabled;
        return { allowed: false };
      },
    });
    expect(seenEnabled).toBe(false);
  });

  it("no-ops the entitlement filter when providers map is missing", () => {
    const m = mkModel();
    let called = false;
    const result = rankModels(mkTask(), [m], {
      checkEntitlement: () => {
        called = true;
        return { allowed: false };
      },
    });
    expect(called).toBe(false);
    expect(result).toHaveLength(1);
  });
});

describe("engine localOnly filter (#157 part 1)", () => {
  it("keeps only local providers when localOnly is set", () => {
    const cloud = mkModel({ id: 1, providerId: 1 });
    const local = mkModel({ id: 2, providerId: 2, modelId: "llama3" });
    const result = rankModels(mkTask(), [cloud, local], {
      providers,
      localOnly: true,
    });
    expect(result.map((r) => r.model.id)).toEqual([2]);
  });
});

describe("engine fallbackToLocal (#157 part 2)", () => {
  it("re-runs local-only when the first pass is empty", () => {
    const cloud = mkModel({ id: 1, providerId: 1 });
    const local = mkModel({ id: 2, providerId: 2, modelId: "llama3" });
    const result = rankModels(mkTask(), [cloud, local], {
      providers,
      checkEntitlement: (pid) =>
        pid === 1
          ? { allowed: false, reason: "no-subscription" }
          : { allowed: true },
      fallbackToLocal: true,
    });
    expect(result.map((r) => r.model.id)).toEqual([2]);
  });

  it("does not fall back when the first pass has results", () => {
    const cloud = mkModel({ id: 1, providerId: 1 });
    const local = mkModel({ id: 2, providerId: 2, modelId: "llama3" });
    const result = rankModels(mkTask(), [cloud, local], {
      providers,
      checkEntitlement: () => ({ allowed: true }),
      fallbackToLocal: true,
    });
    expect(result).toHaveLength(2);
  });

  it("returns empty when fallback also finds nothing", () => {
    const cloud = mkModel({ id: 1, providerId: 1 });
    const local = mkModel({ id: 2, providerId: 2, modelId: "llama3" });
    const result = rankModels(mkTask(), [cloud, local], {
      providers,
      checkEntitlement: () => ({ allowed: false, reason: "no-subscription" }),
      fallbackToLocal: true,
    });
    expect(result).toHaveLength(0);
  });
});
