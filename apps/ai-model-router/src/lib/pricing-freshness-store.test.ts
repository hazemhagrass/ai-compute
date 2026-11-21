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
  it("reports a never-fetched catalog source as missing instead of vanishing", () => {
    expect(getPricingFreshnessRecords()).toEqual([
      { source: "openrouter", fetchedAt: null },
    ]);
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

  it("backfills the catalog record from the cache timestamp and persists it", () => {
    store.set("openrouter_catalog_ts", "1234567");
    expect(getPricingFreshnessRecords()).toEqual([
      { source: "openrouter", fetchedAt: 1_234_567 },
    ]);
    // Persisted, not just synthesized: the next raw write keeps it.
    updateFreshnessRecord("other-source", 9_999);
    expect(getFreshnessRecord("openrouter")).toEqual({
      source: "openrouter",
      fetchedAt: 1_234_567,
    });
  });

  it("ignores the catalog timestamp when it is null, zero or garbage", () => {
    for (const ts of ["0", "-5", "abc", ""]) {
      store.clear();
      store.set("openrouter_catalog_ts", ts);
      expect(getPricingFreshnessRecords()).toEqual([
        { source: "openrouter", fetchedAt: null },
      ]);
    }
  });

  it("keeps an existing catalog record instead of re-reading the cache ts", () => {
    updateFreshnessRecord("openrouter", 1_000);
    // "9999" is a usable number, so this pins the precedence rule (the
    // stored record wins) rather than the garbage-input rule.
    store.set("openrouter_catalog_ts", "9999");
    expect(getFreshnessRecord("openrouter")).toEqual({
      source: "openrouter",
      fetchedAt: 1_000,
    });
  });

  it("records null fetchedAt when a source has no table", () => {
    updateFreshnessRecord("broken-api", null);
    expect(getFreshnessRecord("broken-api")).toEqual({
      source: "broken-api",
      fetchedAt: null,
    });
  });

  it("keeps the record list bounded at 50, plus the always-present catalog source", () => {
    for (let i = 0; i < 55; i++) {
      updateFreshnessRecord(`source-${i}`, i);
    }
    // 50 stored records, then the reader prepends the missing catalog
    // record so "openrouter never fetched" is still reported.
    const records = getPricingFreshnessRecords();
    expect(records).toHaveLength(51);
    expect(records[0]).toEqual({ source: "openrouter", fetchedAt: null });
    expect(records[1].source).toBe("source-5");
  });

  it("backfill into a full store goes through eviction, not around it", () => {
    for (let i = 0; i < 50; i++) {
      updateFreshnessRecord(`source-${i}`, i * 1000);
    }
    store.set("openrouter_catalog_ts", "99000");
    const records = getPricingFreshnessRecords();
    expect(records).toHaveLength(50);
    expect(getFreshnessRecord("openrouter")).toEqual({
      source: "openrouter",
      fetchedAt: 99_000,
    });
    // The persisted list is the trimmed one: no 51-record store on disk.
    const persisted = JSON.parse(store.get("pricing_freshness") ?? "[]") as {
      source: string;
    }[];
    expect(persisted).toHaveLength(50);
    // The oldest non-catalog record made room for the backfill.
    expect(getFreshnessRecord("source-0")).toBeUndefined();
    expect(getFreshnessRecord("source-1")).toEqual({ source: "source-1", fetchedAt: 1000 });
  });

  it("evicts least-recently-updated records so the active source keeps its slot", () => {
    updateFreshnessRecord("openrouter", 1_000);
    for (let i = 0; i < 55; i++) {
      updateFreshnessRecord(`source-${i}`, Date.now() + i * 1000);
      updateFreshnessRecord("openrouter", Date.now() + i * 1000 + 500);
    }
    expect(getFreshnessRecord("openrouter")).toBeDefined();
    expect(getPricingFreshnessRecords()).toHaveLength(50);
  });

  it("evicts never-fetched records first", () => {
    updateFreshnessRecord("openrouter", Date.now() + 10_000);
    updateFreshnessRecord("dead-feed", null);
    for (let i = 0; i < 50; i++) {
      updateFreshnessRecord(`source-${i}`, Date.now() + i);
    }
    const records = getPricingFreshnessRecords();
    expect(records).toHaveLength(50);
    expect(getFreshnessRecord("dead-feed")).toBeUndefined();
    expect(getFreshnessRecord("openrouter")).toBeDefined();
  });

  it("returns the synthesized missing record for corrupted stored JSON", () => {
    store.set("pricing_freshness", "{bad");
    expect(getPricingFreshnessRecords()).toEqual([
      { source: "openrouter", fetchedAt: null },
    ]);
  });
});
