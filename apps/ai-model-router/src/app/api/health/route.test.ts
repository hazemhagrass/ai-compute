import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PricingFreshnessRecord } from "@/lib/pricing-freshness";

const freshnessRecords: PricingFreshnessRecord[] = [];

vi.mock("@/lib/auth", () => ({
  requireAuth: async () => null,
}));

vi.mock("@/lib/health", () => ({
  checkAllProviders: async () => ({
    checkedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 5,
    okCount: 1,
    total: 1,
    results: [
      {
        id: 1,
        name: "Provider One",
        ok: true,
        latencyMs: 12,
        modelCount: 3,
        status: 200,
        error: null,
        keyAudit: null,
      },
    ],
  }),
}));

vi.mock("@/lib/pricing-freshness-store", () => ({
  getPricingFreshnessRecords: () => freshnessRecords,
}));

const route = await import("@/app/api/health/route");

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  freshnessRecords.length = 0;
});

async function getJson(): Promise<{
  checkedAt: string;
  okCount: number;
  total: number;
  results: unknown[];
  pricing: {
    oldestAgeDays: number | null;
    oldestSource: string | null;
    missing: string[];
  };
}> {
  const res = await route.GET();
  expect(res.status).toBe(200);
  return (await res.json()) as Awaited<ReturnType<typeof getJson>>;
}

describe("GET /api/health pricing freshness", () => {
  it("adds the oldest table age next to the untouched provider report", async () => {
    freshnessRecords.push(
      { source: "openrouter", fetchedAt: Date.now() - 3 * DAY },
      { source: "openrouter-tuning", fetchedAt: Date.now() - 9 * DAY },
    );

    const body = await getJson();

    expect(body.checkedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(body.okCount).toBe(1);
    expect(body.total).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.pricing).toEqual({
      oldestAgeDays: 9,
      oldestSource: "openrouter-tuning",
      missing: [],
    });
  });

  it("reports sources with a missing table in the red bucket", async () => {
    freshnessRecords.push(
      { source: "openrouter", fetchedAt: Date.now() },
      { source: "broken-feed", fetchedAt: null },
      { source: "legacy-feed", fetchedAt: 0 },
    );

    const body = await getJson();

    expect(body.pricing).toEqual({
      oldestAgeDays: 0,
      oldestSource: "openrouter",
      missing: ["broken-feed", "legacy-feed"],
    });
  });

  it("reports all-null pricing when no freshness records exist", async () => {
    const body = await getJson();

    expect(body.pricing).toEqual({
      oldestAgeDays: null,
      oldestSource: null,
      missing: [],
    });
  });

  it("reports a null oldest age when every table is missing", async () => {
    freshnessRecords.push({ source: "gone", fetchedAt: null });

    const body = await getJson();

    expect(body.pricing).toEqual({
      oldestAgeDays: null,
      oldestSource: null,
      missing: ["gone"],
    });
  });
});
