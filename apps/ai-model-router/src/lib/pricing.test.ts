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
const { appendPricingAudit, getPricingAudit } = await import("./pricing-audit");
const repo = await import("./repo");
const listModelsMock = vi.mocked(repo.listModels);
const updateModelMock = vi.mocked(repo.updateModel);

// Row shape stored in the aggregate catalog_apply entry's details.
interface CatalogApplyChange {
  modelId: string;
  oldInput: number;
  oldOutput: number;
  inputCost: number;
  outputCost: number;
}

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
  it("apply path writes changed prices and records one aggregate catalog_apply entry", async () => {
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
    // The aggregate entry carries old and new prices, so the audit shows
    // the change, not just the result.
    expect(apply!.details).toEqual({
      count: 1,
      truncated: false,
      changes: [
        {
          modelId: "vendor/m1",
          oldInput: 0.5,
          oldOutput: 1.5,
          inputCost: 1,
          outputCost: 2,
        },
      ],
    });
  });

  it("a 60-model sync keeps prior manual_price_edit and catalog_refresh history", async () => {
    appendPricingAudit({
      actor: "user",
      action: "manual_price_edit",
      details: { modelId: "kept/edit" },
    });
    const catalog = Array.from({ length: 60 }, (_, i) => ({
      id: `vendor/v${i}`,
      pricing: { prompt: "0.000001", completion: "0.000002" },
    }));
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: catalog }) });
    // All 60 models differ from the catalog (0.5/1.5 vs 1/2), so all 60
    // change and would previously have written 60 per-model entries,
    // spilling past the audit bound and evicting the history above.
    listModelsMock.mockReturnValue(
      Array.from({ length: 60 }, (_, i) =>
        makeModel({ id: i + 1, modelId: `vendor/v${i}`, label: `V${i}` }),
      ),
    );

    const res = await syncPricing(true);

    expect(res.applied).toBe(60);
    const audit = getPricingAudit();
    expect(audit.map((e) => e.action)).toEqual([
      "manual_price_edit",
      "catalog_refresh",
      "catalog_apply",
    ]);
    const apply = audit[2];
    expect((apply.details as { count: number }).count).toBe(60);
    expect((apply.details as { truncated: boolean }).truncated).toBe(true);
    const changes = (apply.details as { changes: CatalogApplyChange[] }).changes;
    expect(changes).toHaveLength(25);
    expect(changes[0].modelId).toBe("vendor/v0");
    expect(changes[0].oldInput).toBe(0.5);
    expect(changes[0].outputCost).toBe(2);
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
