import { describe, expect, it } from "vitest";

import { isPricingStale, pricingAgeDays, PRICING_STALE_DAYS } from "./pricing-freshness";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("pricing freshness", () => {
  it("ts 0 is stale", () => {
    expect(isPricingStale(0, 1_000_000, PRICING_STALE_DAYS)).toBe(true);
  });

  it("29d is not stale", () => {
    const now = 100 * DAY_MS;
    expect(isPricingStale(now - 29 * DAY_MS, now, PRICING_STALE_DAYS)).toBe(false);
  });

  it("exactly 30d is not stale", () => {
    const now = 100 * DAY_MS;
    expect(isPricingStale(now - 30 * DAY_MS, now, PRICING_STALE_DAYS)).toBe(false);
  });

  it("30d+1ms is stale", () => {
    const now = 100 * DAY_MS;
    expect(isPricingStale(now - 30 * DAY_MS - 1, now, PRICING_STALE_DAYS)).toBe(true);
  });

  it("pricingAgeDays floors and ts 0 is Infinity", () => {
    const now = 100 * DAY_MS;
    expect(pricingAgeDays(now - 2.5 * DAY_MS, now)).toBe(2);
    expect(pricingAgeDays(0, now)).toBe(Number.POSITIVE_INFINITY);
  });
});