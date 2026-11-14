import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Model } from "./types";

const store = new Map<string, string>();
const fetchMock = vi.fn();

vi.mock("./db", () => ({
  getSetting: (key: string, fallback = "") => store.get(key) ?? fallback,
  setSetting: (key: string, value: string) => {
    store.set(key, value);
  },
}));

vi.mock("./repo", () => ({
  listModels: vi.fn(() => []),
  updateModel: vi.fn(),
}));

const { fetchCatalog, syncPricing } = await import("./pricing");
const { getPricingAudit } = await import("./pricing-audit");
const repo = await import("./repo");
const listModelsMock = vi.mocked(repo.listModels);
const updateModelMock = vi.mocked(repo.updateModel);

function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    id: 7,
    providerId: 1,
    providerSlug: "cloud",
    providerName: "Cloud",
    modelId: "vendor/m1",
    label: "M1",
    quality: 50,
    speed: 50,
    cheapness: 50,
    contextWindow: 8192,
    maxOutput: 4096,
    inputCost: 0.5,
    outputCost: 1.5,
    skills: {},
    features: {
      tools: false,
      vision: false,
      json: false,
      streaming: false,
      reasoning: false,
      audio: false,
      embedding: false,
    },
    tags: [],
    notes: "",
    enabled: true,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  store.clear();
  fetchMock.mockReset();
  listModelsMock.mockReturnValue([]);
  updateModelMock.mockClear();
});

afterEach(() => {
  // A mid-test failure must not leak the fetch stub or fake clock into
  // the next test.
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchCatalog", () => {
  it("force refresh appends one catalog_refresh entry and returns stored ts as cachedAt", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "m1", pricing: { prompt: "0.000001", completion: "0.000002" } }] }),
    });

    const before = Date.now();
    const res = await fetchCatalog(true);
    expect(res.fromCache).toBe(false);
    expect(res.entries).toHaveLength(1);
    const audit = getPricingAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0].actor).toBe("system");
    expect(audit[0].action).toBe("catalog_refresh");
    expect((audit[0].details as { count: number }).count).toBe(1);
    // cachedAt equals stored ts
    const ts = Number(store.get("openrouter_catalog_ts"));
    expect(res.cachedAt).toBe(new Date(ts).toISOString());
    expect(ts).toBeGreaterThanOrEqual(before);
    // the freshness record mirrors the cache timestamp (one truth)
    const records = JSON.parse(store.get("pricing_freshness") ?? "[]") as {
      source: string;
      fetchedAt: number;
    }[];
    expect(records).toContainEqual({ source: "openrouter", fetchedAt: ts });
  });

  it("cache hit returns stored timestamp, not now (fake timers)", async () => {
    const storedTs = Date.now() - 1000;
    store.set("openrouter_catalog_ts", String(storedTs));
    store.set("openrouter_catalog", JSON.stringify([{ id: "m1" }]));
    vi.useFakeTimers();
    vi.setSystemTime(new Date(storedTs + 1000));
    const res = await fetchCatalog(false);
    expect(res.fromCache).toBe(true);
    expect(res.cachedAt).toBe(new Date(storedTs).toISOString());
  });

  it("no stored timestamp: fetches fresh (sensible)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    const res = await fetchCatalog(false);
    // no ts -> not fresh -> fetch
    expect(res.fromCache).toBe(false);
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("syncPricing", () => {
  it("apply path writes changed prices and records one catalog_apply entry per model", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "vendor/m1", pricing: { prompt: "0.000001", completion: "0.000002" } },
        ],
      }),
    });
    listModelsMock.mockReturnValue([makeModel()]);

    const res = await syncPricing(true);

    expect(res.applied).toBe(1);
    expect(updateModelMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ inputCost: 1, outputCost: 2 }),
    );
    const apply = getPricingAudit().find((e) => e.action === "catalog_apply");
    expect(apply).toBeDefined();
    expect((apply!.details as { modelId: string }).modelId).toBe("vendor/m1");
    expect(apply!.details.inputCost).toBe(1);
  });

  it("dry run changes nothing and audits nothing beyond the catalog refresh", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "vendor/m1", pricing: { prompt: "0.000001", completion: "0.000002" } },
        ],
      }),
    });
    listModelsMock.mockReturnValue([makeModel()]);

    const res = await syncPricing(false);

    expect(res.applied).toBe(0);
    expect(res.matches[0].changed).toBe(true);
    expect(updateModelMock).not.toHaveBeenCalled();
    expect(getPricingAudit().filter((e) => e.action !== "catalog_refresh")).toHaveLength(0);
  });
});
