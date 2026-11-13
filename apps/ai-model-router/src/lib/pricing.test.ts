import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

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

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { fetchCatalog } = await import("./pricing");
const { getPricingAudit } = await import("./pricing-audit");

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
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
    vi.useRealTimers();
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
