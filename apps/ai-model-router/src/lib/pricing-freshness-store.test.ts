import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("./db", () => ({
  getSetting: (key: string, fallback = "") => store.get(key) ?? fallback,
  setSetting: (key: string, value: string) => {
    store.set(key, value);
  },
}));

const {
  getFreshnessRecord,
  getPricingFreshnessRecords,
  updateFreshnessRecord,
} = await import("./pricing-freshness-store");

beforeEach(() => {
  store.clear();
});

describe("pricing freshness store", () => {
  it("starts empty and stores per-source fetchedAt", () => {
    expect(getPricingFreshnessRecords()).toEqual([]);
    updateFreshnessRecord("openrouter", 1_000);
    expect(getFreshnessRecord("openrouter")).toEqual({
      source: "openrouter",
      fetchedAt: 1_000,
    });
  });

  it("replaces an existing source instead of duplicating it", () => {
    updateFreshnessRecord("openrouter", 1_000);
    updateFreshnessRecord("openrouter", 2_000);
    updateFreshnessRecord("openrouter-tuning", 3_000);
    const records = getPricingFreshnessRecords();
    expect(records).toHaveLength(2);
    expect(getFreshnessRecord("openrouter")?.fetchedAt).toBe(2_000);
  });

  it("records null fetchedAt when a source has no table", () => {
    updateFreshnessRecord("broken-api", null);
    expect(getFreshnessRecord("broken-api")?.fetchedAt).toBeNull();
  });

  it("keeps the record list bounded at 50", () => {
    for (let i = 0; i < 55; i++) {
      updateFreshnessRecord(`source-${i}`, i);
    }
    const records = getPricingFreshnessRecords();
    expect(records).toHaveLength(50);
    expect(records[0].source).toBe("source-5");
  });

  it("returns empty for corrupted stored JSON", () => {
    store.set("pricing_freshness", "{bad");
    expect(getPricingFreshnessRecords()).toEqual([]);
  });
});
