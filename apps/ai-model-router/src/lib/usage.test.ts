import { describe, expect, it } from "vitest";

import { computeCost } from "./usage";

describe("computeCost", () => {
  it("bills 1M in + 1M out at $5/$25 as exactly $30", () => {
    const c = computeCost(1_000_000, 1_000_000, 5, 25);

    expect(c.inputCostUsd).toBeCloseTo(5, 10);
    expect(c.outputCostUsd).toBeCloseTo(25, 10);
    expect(c.costUsd).toBeCloseTo(30, 10);
  });

  it("bills a realistic 12k/3k Sonnet call at $0.081", () => {
    const c = computeCost(12_000, 3_000, 3, 15);

    expect(c.costUsd).toBeCloseTo(0.081, 10);
  });

  it("charges nothing for a local model regardless of volume", () => {
    const c = computeCost(5_000_000, 2_000_000, 0, 0);

    expect(c.costUsd).toBe(0);
  });

  it("keeps sub-cent calls non-zero instead of rounding them away", () => {
    // A cheap model over many calls still adds up; truncating here would make
    // the whole analytics surface under-report bulk workloads.
    const c = computeCost(100, 50, 0.25, 2);

    expect(c.costUsd).toBeGreaterThan(0);
    expect(c.costUsd).toBeCloseTo(100e-6 * 0.25 + 50e-6 * 2, 12);
  });

  it("splits input and output cost so each is separately reportable", () => {
    const c = computeCost(1_000_000, 1_000_000, 1, 10);

    expect(c.inputCostUsd).toBeCloseTo(1, 10);
    expect(c.outputCostUsd).toBeCloseTo(10, 10);
    expect(c.inputCostUsd + c.outputCostUsd).toBeCloseTo(c.costUsd, 10);
  });

  it("treats a missing price as free rather than NaN", () => {
    // A freshly discovered model has no price yet. NaN would poison every
    // downstream SUM() in the analytics queries.
    const c = computeCost(1000, 1000, Number.NaN, undefined as unknown as number);

    expect(Number.isFinite(c.costUsd)).toBe(true);
    expect(c.costUsd).toBe(0);
  });

  it("never returns a negative cost from a corrupt token count", () => {
    const c = computeCost(-500, -100, 3, 15);

    expect(c.costUsd).toBe(0);
  });

  it("scales linearly with token count", () => {
    const one = computeCost(1_000, 1_000, 3, 15).costUsd;
    const ten = computeCost(10_000, 10_000, 3, 15).costUsd;

    expect(ten).toBeCloseTo(one * 10, 10);
  });
});
