import { describe, expect, it } from "vitest";

import {
  ESTIMATED_CACHE_READ_RATIO,
  ESTIMATED_CACHE_WRITE_RATIO,
  computeDetailedCost,
  savingsFromCache,
} from "./cached-pricing";

const SONNET = { inputPer1M: 3, outputPer1M: 15 };

describe("computeDetailedCost", () => {
  it("splits a prompt into fresh and cached input at their own rates", () => {
    const c = computeDetailedCost(
      { inputTokens: 10_000, cachedTokens: 8_000, outputTokens: 1_000 },
      SONNET,
    );

    expect(c.freshInputTokens).toBe(2_000);
    expect(c.cachedTokens).toBe(8_000);
    expect(c.freshInputCostUsd).toBeCloseTo(0.006, 12);
    expect(c.cachedInputCostUsd).toBeCloseTo(0.0024, 12);
    expect(c.outputCostUsd).toBeCloseTo(0.015, 12);
    expect(c.costUsd).toBeCloseTo(0.0234, 12);
  });

  it("defaults a missing cached rate to a tenth of the input rate", () => {
    const c = computeDetailedCost({ inputTokens: 1_000_000, cachedTokens: 1_000_000 }, SONNET);

    expect(ESTIMATED_CACHE_READ_RATIO).toBe(0.1);
    expect(c.rates.cachedInputPer1M).toBeCloseTo(0.3, 12);
    expect(c.cachedInputCostUsd).toBeCloseTo(0.3, 12);
    expect(c.ratesEstimated).toBe(true);
  });

  it("uses a published cached rate over the estimate", () => {
    const c = computeDetailedCost(
      { inputTokens: 1_000_000, cachedTokens: 1_000_000 },
      { ...SONNET, cachedInputPer1M: 0.5, cacheWritePer1M: 4 },
    );

    expect(c.rates.cachedInputPer1M).toBe(0.5);
    expect(c.cachedInputCostUsd).toBeCloseTo(0.5, 12);
    expect(c.ratesEstimated).toBe(false);
  });

  it("charges cache writes at a premium over the input rate", () => {
    const c = computeDetailedCost({ cacheWriteTokens: 1_000_000 }, SONNET);

    expect(ESTIMATED_CACHE_WRITE_RATIO).toBe(1.25);
    expect(c.rates.cacheWritePer1M).toBeCloseTo(3.75, 12);
    expect(c.cacheWriteCostUsd).toBeCloseTo(3.75, 12);
  });

  it("makes the first cached call cost more than the naive maths predicts", () => {
    // Populating the cache is the easily missed line item.
    const first = computeDetailedCost(
      { inputTokens: 10_000, cacheWriteTokens: 10_000, outputTokens: 1_000 },
      SONNET,
    );
    const naive = computeDetailedCost(
      { inputTokens: 10_000, outputTokens: 1_000 },
      SONNET,
    );

    expect(first.costUsd).toBeGreaterThan(naive.costUsd);
    expect(first.costUsd - naive.costUsd).toBeCloseTo(0.0375, 12);
  });

  it("bills reasoning tokens at the output rate, not the input rate", () => {
    const c = computeDetailedCost({ reasoningTokens: 1_000_000 }, SONNET);

    expect(c.reasoningCostUsd).toBeCloseTo(15, 12);
    expect(c.reasoningCostUsd).not.toBeCloseTo(3, 12);
    expect(c.costUsd).toBeCloseTo(15, 12);
  });

  it("sums every line item into the total", () => {
    const c = computeDetailedCost(
      {
        inputTokens: 10_000,
        cachedTokens: 8_000,
        cacheWriteTokens: 4_000,
        outputTokens: 1_000,
        reasoningTokens: 500,
      },
      SONNET,
    );

    expect(c.freshInputCostUsd).toBeCloseTo(0.006, 12);
    expect(c.cachedInputCostUsd).toBeCloseTo(0.0024, 12);
    expect(c.cacheWriteCostUsd).toBeCloseTo(0.015, 12);
    expect(c.outputCostUsd).toBeCloseTo(0.015, 12);
    expect(c.reasoningCostUsd).toBeCloseTo(0.0075, 12);
    expect(c.costUsd).toBeCloseTo(0.0459, 12);
  });

  it("never lets cached tokens exceed the prompt and refund the caller", () => {
    const c = computeDetailedCost({ inputTokens: 1_000, cachedTokens: 5_000 }, SONNET);

    expect(c.freshInputTokens).toBe(0);
    expect(c.cachedTokens).toBe(1_000);
    expect(c.freshInputCostUsd).toBe(0);
    expect(c.costUsd).toBeGreaterThan(0);
  });

  it("yields 0 rather than NaN for a NaN rate", () => {
    const c = computeDetailedCost(
      { inputTokens: 1_000, cachedTokens: 500, cacheWriteTokens: 500, outputTokens: 100 },
      { inputPer1M: Number.NaN, outputPer1M: Number.NaN },
    );

    expect(Number.isFinite(c.costUsd)).toBe(true);
    expect(c.costUsd).toBe(0);
    expect(c.cachedInputCostUsd).toBe(0);
    expect(c.cacheWriteCostUsd).toBe(0);
    expect(c.rates.cachedInputPer1M).toBe(0);
    expect(c.ratesEstimated).toBe(false);
  });

  it("yields 0 rather than NaN for NaN and Infinity token counts", () => {
    const c = computeDetailedCost(
      {
        inputTokens: Number.NaN,
        cachedTokens: Number.POSITIVE_INFINITY,
        cacheWriteTokens: Number.NaN,
        outputTokens: Number.NaN,
        reasoningTokens: Number.NaN,
      },
      SONNET,
    );

    expect(c.costUsd).toBe(0);
    expect(c.cachedTokens).toBe(0);
    expect(c.outputTokens).toBe(0);
  });

  it("treats negative tokens and negative rates as 0", () => {
    const c = computeDetailedCost(
      { inputTokens: -500, cachedTokens: -100, cacheWriteTokens: -50, outputTokens: -10 },
      { inputPer1M: -3, outputPer1M: -15 },
    );

    expect(c.costUsd).toBe(0);
    expect(c.freshInputTokens).toBe(0);
    expect(c.rates.inputPer1M).toBe(0);
  });

  it("treats undefined usage and undefined rates as a free empty call", () => {
    const c = computeDetailedCost(undefined, undefined);

    expect(c.costUsd).toBe(0);
    expect(c.freshInputTokens).toBe(0);
    expect(c.rates.outputPer1M).toBe(0);
    expect(c.ratesEstimated).toBe(false);
  });

  it("treats missing numeric fields as 0 without NaN leaking in", () => {
    const c = computeDetailedCost({ outputTokens: 1_000 }, SONNET);

    expect(c.freshInputTokens).toBe(0);
    expect(c.cachedTokens).toBe(0);
    expect(c.cacheWriteTokens).toBe(0);
    expect(c.reasoningCostUsd).toBe(0);
    expect(c.costUsd).toBeCloseTo(0.015, 12);
  });

  it("charges nothing for a zero-token call", () => {
    const c = computeDetailedCost(
      {
        inputTokens: 0,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
      },
      SONNET,
    );

    expect(c.costUsd).toBe(0);
  });

  it("charges nothing for a local model regardless of volume", () => {
    const c = computeDetailedCost(
      { inputTokens: 5_000_000, cachedTokens: 4_000_000, cacheWriteTokens: 1_000_000 },
      { inputPer1M: 0, outputPer1M: 0 },
    );

    expect(c.costUsd).toBe(0);
    expect(c.ratesEstimated).toBe(false);
  });
});

describe("savingsFromCache", () => {
  it("reports the exact dollars the cache avoided", () => {
    const c = computeDetailedCost(
      { inputTokens: 10_000, cachedTokens: 8_000, outputTokens: 1_000 },
      SONNET,
    );
    const s = savingsFromCache(c);

    // 8k cached tokens cost $0.0024 instead of $0.024.
    expect(s.uncachedCostUsd).toBeCloseTo(0.045, 12);
    expect(s.actualCostUsd).toBeCloseTo(0.0234, 12);
    expect(s.savedUsd).toBeCloseTo(0.0216, 12);
    expect(s.savedShare).toBeCloseTo(0.48, 12);
  });

  it("counts the cache write against the saving on a first call", () => {
    const c = computeDetailedCost(
      { inputTokens: 10_000, cacheWriteTokens: 10_000, outputTokens: 1_000 },
      SONNET,
    );
    const s = savingsFromCache(c);

    expect(s.savedUsd).toBeCloseTo(-0.0375, 12);
    expect(s.savedShare).toBeLessThan(0);
  });

  it("reports no saving when nothing was cached", () => {
    const c = computeDetailedCost({ inputTokens: 10_000, outputTokens: 1_000 }, SONNET);
    const s = savingsFromCache(c);

    expect(s.savedUsd).toBe(0);
    expect(s.savedShare).toBe(0);
    expect(s.uncachedCostUsd).toBeCloseTo(s.actualCostUsd, 12);
  });

  it("returns 0 instead of NaN when the counterfactual bill is 0", () => {
    const s = savingsFromCache(computeDetailedCost({}, {}));

    expect(s.uncachedCostUsd).toBe(0);
    expect(s.savedUsd).toBe(0);
    expect(s.savedShare).toBe(0);
  });

  it("caps the saving at the published cached discount", () => {
    const c = computeDetailedCost(
      { inputTokens: 1_000_000, cachedTokens: 1_000_000 },
      { ...SONNET, cachedInputPer1M: 0.3 },
    );
    const s = savingsFromCache(c);

    expect(s.uncachedCostUsd).toBeCloseTo(3, 12);
    expect(s.actualCostUsd).toBeCloseTo(0.3, 12);
    expect(s.savedUsd).toBeCloseTo(2.7, 12);
    expect(s.savedShare).toBeCloseTo(0.9, 12);
  });
});
