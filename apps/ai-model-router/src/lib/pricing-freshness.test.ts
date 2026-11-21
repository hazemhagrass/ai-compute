import { describe, expect, it } from "vitest";

import {
  clampPricingStaleDays,
  pricingAgeDays,
  isPricingStale,
  isUsableFetchedAt,
  freshnessState,
  summarizePricingFreshness,
} from "@/lib/pricing-freshness";

describe("isUsableFetchedAt", () => {
  it("accepts finite positive timestamps only", () => {
    expect(isUsableFetchedAt(1000)).toBe(true);
    expect(isUsableFetchedAt(1)).toBe(true);
    for (const ts of [null, 0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isUsableFetchedAt(ts)).toBe(false);
    }
  });

  it("narrows the type to number", () => {
    const ts: number | null = 5000;
    if (isUsableFetchedAt(ts)) {
      expect(ts + 1).toBe(5001);
    } else {
      throw new Error("should be usable");
    }
  });
});

describe("pricingAgeDays", () => {
  it("returns positive infinity for non-positive timestamps", () => {
    expect(pricingAgeDays(0, 1000)).toBe(Infinity);
    expect(pricingAgeDays(-100, 1000)).toBe(Infinity);
    expect(pricingAgeDays(NaN, 1000)).toBe(Infinity);
  });

  it("returns 0 for timestamps within today", () => {
    const now = Date.now();
    expect(pricingAgeDays(now - 1000, now)).toBe(0);
    expect(pricingAgeDays(now - 5 * 60 * 1000, now)).toBe(0);
    expect(pricingAgeDays(now, now)).toBe(0);
  });

  it("calculates correct age for recent timestamps", () => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    expect(pricingAgeDays(oneDayAgo, now)).toBe(1);
    expect(pricingAgeDays(oneDayAgo + 1000, now)).toBe(0);

    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    expect(pricingAgeDays(sevenDaysAgo, now)).toBe(7);
  });

  it("rounds down to full days", () => {
    const now = Date.now();
    const oneDayHalf = now - 36 * 60 * 60 * 1000;
    expect(pricingAgeDays(oneDayHalf, now)).toBe(1);

    const oneDayOneHour = now - 25 * 60 * 60 * 1000;
    expect(pricingAgeDays(oneDayOneHour, now)).toBe(1);
  });
});

describe("isPricingStale", () => {
  it("returns true for zero timestamp", () => {
    expect(isPricingStale(0, 1000, 14)).toBe(true);
  });

  it("returns false for very recent timestamps", () => {
    const now = Date.now();
    expect(isPricingStale(now - 5 * 60 * 1000, now, 14)).toBe(false);
    expect(isPricingStale(now, now, 14)).toBe(false);
  });

  it("returns true when age exceeds threshold", () => {
    const now = Date.now();
    expect(isPricingStale(now - 15 * 24 * 60 * 60 * 1000, now, 14)).toBe(true);
    expect(isPricingStale(now - 30 * 24 * 60 * 60 * 1000, now, 14)).toBe(true);
  });

  it("returns true for negative timestamps like pricingAgeDays", () => {
    expect(isPricingStale(-100, 1000, 14)).toBe(true);
    expect(isPricingStale(-100, 1000, 1000)).toBe(true);
  });

  it("returns false when age is below threshold", () => {
    const now = Date.now();
    expect(isPricingStale(now - 14 * 24 * 60 * 60 * 1000, now, 14)).toBe(false);
    expect(isPricingStale(now - 10 * 24 * 60 * 60 * 1000, now, 14)).toBe(false);
  });
});

describe("freshnessState", () => {
  it("returns red for null fetchedAt", () => {
    expect(freshnessState(null, Date.now(), 14)).toBe("red");
  });

  it("returns ok for recent timestamps", () => {
    const now = Date.now();
    expect(freshnessState(now - 5 * 60 * 1000, now, 14)).toBe("ok");
    expect(freshnessState(now, now, 14)).toBe("ok");
  });

  it("returns amber for near-expiry timestamps", () => {
    const now = Date.now();
    const oneDayStale = now - 15 * 24 * 60 * 60 * 1000;
    expect(freshnessState(oneDayStale, now, 14)).toBe("amber");

    const oneMsPastThreshold = now - 14 * 24 * 60 * 60 * 1000 - 1;
    expect(freshnessState(oneMsPastThreshold, now, 14)).toBe("amber");
  });

  it("returns red for missing and nonsensical timestamps", () => {
    const now = Date.now();
    expect(freshnessState(null, now, 14)).toBe("red");
    expect(freshnessState(0, now, 14)).toBe("red");
    expect(freshnessState(-5, now, 14)).toBe("red");
    expect(freshnessState(Number.NaN, now, 14)).toBe("red");
  });

  it("returns ok for exactly-at-threshold timestamps", () => {
    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    expect(freshnessState(fourteenDaysAgo, now, 14)).toBe("ok");
  });

  it("honors a custom staleDays threshold", () => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    expect(freshnessState(now - 31 * DAY, now, 30)).toBe("amber");
    expect(freshnessState(now - 30 * DAY, now, 30)).toBe("ok");
    expect(freshnessState(now - 8 * DAY, now, 7)).toBe("amber");
    expect(freshnessState(now - 7 * DAY, now, 7)).toBe("ok");
  });
});

describe("summarizePricingFreshness", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 1_900_000_000_000;

  it("reports the floored age of the oldest table and its source", () => {
    const summary = summarizePricingFreshness(
      [
        { source: "openrouter", fetchedAt: now - 3 * DAY },
        { source: "openrouter-tuning", fetchedAt: now - (10 * DAY + DAY / 2) },
      ],
      now,
    );
    expect(summary).toEqual({
      oldestAgeDays: 10,
      oldestSource: "openrouter-tuning",
      missing: [],
    });
  });

  it("lists missing tables without letting them win the oldest age", () => {
    const summary = summarizePricingFreshness(
      [
        { source: "never-fetched", fetchedAt: null },
        { source: "zeroed", fetchedAt: 0 },
        { source: "garbage", fetchedAt: Number.NaN },
        { source: "live-feed", fetchedAt: now - DAY },
      ],
      now,
    );
    expect(summary).toEqual({
      oldestAgeDays: 1,
      oldestSource: "live-feed",
      missing: ["never-fetched", "zeroed", "garbage"],
    });
  });

  it("returns nulls and an empty missing list for no records", () => {
    expect(summarizePricingFreshness([], now)).toEqual({
      oldestAgeDays: null,
      oldestSource: null,
      missing: [],
    });
  });

  it("reports null oldest when every table is missing", () => {
    const summary = summarizePricingFreshness(
      [
        { source: "a", fetchedAt: null },
        { source: "b", fetchedAt: 0 },
      ],
      now,
    );
    expect(summary).toEqual({
      oldestAgeDays: null,
      oldestSource: null,
      missing: ["a", "b"],
    });
  });

  it("keeps the first source when ages tie", () => {
    const summary = summarizePricingFreshness(
      [
        { source: "first", fetchedAt: now - 2 * DAY },
        { source: "second", fetchedAt: now - 2 * DAY },
      ],
      now,
    );
    expect(summary.oldestSource).toBe("first");
  });
});

describe("clampPricingStaleDays", () => {
  it("passes valid integers through", () => {
    expect(clampPricingStaleDays(1)).toBe(1);
    expect(clampPricingStaleDays(14)).toBe(14);
    expect(clampPricingStaleDays(365)).toBe(365);
  });

  it("clamps out-of-range values into 1..365", () => {
    expect(clampPricingStaleDays(0)).toBe(1);
    expect(clampPricingStaleDays(-3)).toBe(1);
    expect(clampPricingStaleDays(366)).toBe(365);
    expect(clampPricingStaleDays(1000)).toBe(365);
  });

  it("falls back to the default 14 for unparseable input", () => {
    expect(clampPricingStaleDays("abc")).toBe(14);
    expect(clampPricingStaleDays("")).toBe(14);
    expect(clampPricingStaleDays(null)).toBe(14);
    expect(clampPricingStaleDays(Number.NaN)).toBe(14);
  });
});
