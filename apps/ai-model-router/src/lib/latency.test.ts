import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// A scratch data dir per run, set before the db module resolves its paths, so
// tests never read or write the developer's real router.db.
const DIR = mkdtempSync(join(tmpdir(), "amr-latency-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "test.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

const { getDb } = await import("./db");
const {
  blendedSpeedScore,
  observedLatency,
  observedSpeedScore,
  percentile,
  FULL_CONFIDENCE_SAMPLES,
  MIN_SAMPLES,
} = await import("./latency");

// Opening the database seeds a starter catalogue of providers and models, so
// every assertion below is scoped to a model_row_id this file allocated.
let nextModelRowId = 900_000;
const allocModelRowId = () => ++nextModelRowId;

const NOW = new Date("2026-06-15T12:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

interface SeedRow {
  latencyMs: number;
  tokensPerSec?: number;
  daysAgo?: number;
  ok?: boolean;
}

function seedEvents(modelRowId: number, rows: SeedRow[]): void {
  const db = getDb();
  const ins = db.prepare(
    `INSERT INTO usage_events (ts, model_row_id, model_id, latency_ms, tokens_per_sec, ok)
     VALUES (?,?,?,?,?,?)`,
  );
  db.transaction(() => {
    for (const r of rows) {
      ins.run(
        daysAgo(r.daysAgo ?? 1),
        modelRowId,
        `scratch-${modelRowId}`,
        r.latencyMs,
        r.tokensPerSec ?? 0,
        r.ok === false ? 0 : 1,
      );
    }
  })();
}

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

beforeAll(() => {
  getDb();
});

describe("percentile", () => {
  it("uses nearest rank, returning an actually observed value", () => {
    const sorted = [100, 200, 300, 400, 500];

    // Never an interpolated midpoint: every figure is a real measurement.
    expect(percentile(sorted, 50)).toBe(300);
    expect(sorted).toContain(percentile(sorted, 95));
  });

  it("clamps the ends instead of running off the array", () => {
    const sorted = [10, 20, 30];

    expect(percentile(sorted, 0)).toBe(10);
    expect(percentile(sorted, 100)).toBe(30);
  });

  it("is not the mean, so one slow outlier cannot be averaged away", () => {
    const sorted = [1, 1, 1, 1, 1, 1, 1, 1, 1, 10_000];
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;

    expect(percentile(sorted, 50)).toBe(1);
    expect(percentile(sorted, 100)).toBe(10_000);
    expect(percentile(sorted, 100)).toBeGreaterThan(mean);
  });
});

describe("observedLatency percentile maths", () => {
  // 20 samples of 100..2000ms: nearest rank gives exact, hand-checkable
  // answers (p50 -> rank 10, p95 -> rank 19, p99 -> rank 20).
  const modelRowId = allocModelRowId();

  beforeAll(() => {
    seedEvents(
      modelRowId,
      Array.from({ length: 20 }, (_, i) => ({
        latencyMs: (i + 1) * 100,
        tokensPerSec: (i + 1) * 5,
      })),
    );
  });

  it("computes p50, p95 and p99 against a known fixed sample", () => {
    const o = observedLatency(getDb(), modelRowId, { now: NOW });

    expect(o).not.toBeNull();
    expect(o?.samples).toBe(20);
    expect(o?.p50Ms).toBe(1000);
    expect(o?.p95Ms).toBe(1900);
    expect(o?.p99Ms).toBe(2000);
  });

  it("reports a median tokens-per-second, not an average", () => {
    const o = observedLatency(getDb(), modelRowId, { now: NOW });

    expect(o?.medianTokensPerSec).toBe(50);
  });

  it("reports the window it actually used", () => {
    const o = observedLatency(getDb(), modelRowId, { now: NOW, windowDays: 30 });

    expect(o?.windowDays).toBe(30);
    expect(o?.since).toBe(daysAgo(30));
  });

  it("does not leak rows from another model", () => {
    const other = allocModelRowId();
    seedEvents(
      other,
      Array.from({ length: 6 }, () => ({ latencyMs: 99_000 })),
    );

    const o = observedLatency(getDb(), modelRowId, { now: NOW });

    expect(o?.samples).toBe(20);
    expect(o?.p99Ms).toBe(2000);
  });
});

describe("minimum sample threshold", () => {
  it("returns null below the threshold rather than a noisy number", () => {
    const modelRowId = allocModelRowId();
    seedEvents(modelRowId, [
      { latencyMs: 100 },
      { latencyMs: 200 },
      { latencyMs: 9000 },
    ]);

    expect(observedLatency(getDb(), modelRowId, { now: NOW })).toBeNull();
  });

  it("returns null for a model with no recorded usage at all", () => {
    expect(observedLatency(getDb(), allocModelRowId(), { now: NOW })).toBeNull();
  });

  it("starts reporting exactly at the threshold", () => {
    const modelRowId = allocModelRowId();
    seedEvents(
      modelRowId,
      Array.from({ length: MIN_SAMPLES - 1 }, () => ({ latencyMs: 500 })),
    );
    expect(observedLatency(getDb(), modelRowId, { now: NOW })).toBeNull();

    seedEvents(modelRowId, [{ latencyMs: 500 }]);
    const o = observedLatency(getDb(), modelRowId, { now: NOW });

    expect(o?.samples).toBe(MIN_SAMPLES);
    expect(o?.p50Ms).toBe(500);
  });

  it("honours a caller-supplied threshold", () => {
    const modelRowId = allocModelRowId();
    seedEvents(
      modelRowId,
      Array.from({ length: 6 }, () => ({ latencyMs: 700 })),
    );

    expect(observedLatency(getDb(), modelRowId, { now: NOW, minSamples: 50 })).toBeNull();
    expect(
      observedLatency(getDb(), modelRowId, { now: NOW, minSamples: 3 })?.samples,
    ).toBe(6);
  });

  it("ignores failed calls and unrecorded timings when counting samples", () => {
    const modelRowId = allocModelRowId();
    seedEvents(modelRowId, [
      { latencyMs: 400 },
      { latencyMs: 400 },
      { latencyMs: 400 },
      // A failed request measures the failure, and a 0 would look like the
      // fastest call ever recorded. Neither is a speed sample.
      { latencyMs: 400, ok: false },
      { latencyMs: 400, ok: false },
      { latencyMs: 0 },
      { latencyMs: 0 },
    ]);

    expect(observedLatency(getDb(), modelRowId, { now: NOW })).toBeNull();
  });
});

describe("recency window", () => {
  it("excludes rows older than the window", () => {
    const modelRowId = allocModelRowId();
    // A provider that used to be slow and has since got faster.
    seedEvents(modelRowId, [
      ...Array.from({ length: 8 }, () => ({ latencyMs: 20_000, daysAgo: 60 })),
      ...Array.from({ length: 6 }, () => ({ latencyMs: 300, daysAgo: 2 })),
    ]);

    const o = observedLatency(getDb(), modelRowId, { now: NOW, windowDays: 30 });

    expect(o?.samples).toBe(6);
    expect(o?.p99Ms).toBe(300);
  });

  it("includes those same rows when the window is widened", () => {
    const modelRowId = allocModelRowId();
    seedEvents(modelRowId, [
      ...Array.from({ length: 8 }, () => ({ latencyMs: 20_000, daysAgo: 60 })),
      ...Array.from({ length: 6 }, () => ({ latencyMs: 300, daysAgo: 2 })),
    ]);

    const o = observedLatency(getDb(), modelRowId, { now: NOW, windowDays: 365 });

    expect(o?.samples).toBe(14);
    expect(o?.p99Ms).toBe(20_000);
  });

  it("returns null when every sample has aged out of the window", () => {
    const modelRowId = allocModelRowId();
    seedEvents(
      modelRowId,
      Array.from({ length: 30 }, () => ({ latencyMs: 500, daysAgo: 90 })),
    );

    expect(observedLatency(getDb(), modelRowId, { now: NOW, windowDays: 30 })).toBeNull();
  });
});

describe("observedSpeedScore", () => {
  const at = (p95Ms: number, medianTokensPerSec = 0) =>
    observedSpeedScore({
      samples: FULL_CONFIDENCE_SAMPLES,
      p50Ms: p95Ms,
      p95Ms,
      p99Ms: p95Ms,
      medianTokensPerSec,
      since: daysAgo(30),
      windowDays: 30,
    });

  it("scores a fast model high and a slow one near zero", () => {
    expect(at(100, 400)).toBe(100);
    expect(at(60_000, 0)).toBe(0);
  });

  it("falls monotonically as p95 rises", () => {
    const fast = at(500, 100);
    const mid = at(3000, 100);
    const slow = at(15_000, 100);

    expect(fast).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(slow);
  });

  it("rewards throughput once latency is equal", () => {
    expect(at(3000, 200)).toBeGreaterThan(at(3000, 10));
  });

  it("stays inside 0-100", () => {
    for (const p95 of [1, 250, 900, 5000, 29_999, 1_000_000]) {
      const s = at(p95, 5000);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

describe("blendedSpeedScore", () => {
  const observation = (samples: number, p95Ms: number, tps = 0) => ({
    samples,
    p50Ms: Math.round(p95Ms / 2),
    p95Ms,
    p99Ms: p95Ms,
    medianTokensPerSec: tps,
    since: daysAgo(30),
    windowDays: 30,
  });

  it("falls back to the declared score when there is no observation", () => {
    expect(blendedSpeedScore(null, 72)).toBe(72);
  });

  it("keeps a brand-new model rankable instead of scoring it zero", () => {
    // No history at all: scoring 0 would mean never chosen, so never
    // measured, so never scored.
    expect(blendedSpeedScore(null, 85)).toBeGreaterThan(0);
  });

  it("prefers observed data over the declared score at full confidence", () => {
    const declared = 95;
    const slowReality = observation(FULL_CONFIDENCE_SAMPLES * 2, 20_000);

    // The hand-written score claims this model is quick; twenty seconds at p95
    // says otherwise, and the measurement wins outright.
    expect(blendedSpeedScore(slowReality, declared)).toBeLessThan(20);
    expect(blendedSpeedScore(slowReality, declared)).toBe(
      observedSpeedScore(slowReality),
    );
  });

  it("also overrides a pessimistic declared score when reality is fast", () => {
    const fast = observation(FULL_CONFIDENCE_SAMPLES, 150, 300);

    expect(blendedSpeedScore(fast, 10)).toBe(100);
  });

  it("mixes the two while confidence is still building", () => {
    const declared = 90;
    const few = observation(MIN_SAMPLES, 20_000);
    const many = observation(FULL_CONFIDENCE_SAMPLES, 20_000);
    const blendedFew = blendedSpeedScore(few, declared);

    // Five samples nudge the score toward reality without owning it.
    expect(blendedFew).toBeLessThan(declared);
    expect(blendedFew).toBeGreaterThan(blendedSpeedScore(many, declared));
  });

  it("moves further toward the observation as samples accumulate", () => {
    const declared = 90;
    const scores = [5, 10, 15, 20].map((n) =>
      blendedSpeedScore(observation(n, 20_000), declared),
    );

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i] as number).toBeLessThan(scores[i - 1] as number);
    }
  });

  it("clamps a malformed declared score instead of propagating it", () => {
    expect(blendedSpeedScore(null, 500)).toBe(100);
    expect(blendedSpeedScore(null, -20)).toBe(0);
    expect(blendedSpeedScore(null, Number.NaN)).toBe(0);
  });
});

describe("end to end over recorded usage", () => {
  it("replaces a fictional declared score with the measured one", () => {
    const modelRowId = allocModelRowId();
    // Declared "very fast", actually 8-9 seconds in the field.
    seedEvents(
      modelRowId,
      Array.from({ length: 40 }, (_, i) => ({
        latencyMs: 8000 + i * 25,
        tokensPerSec: 12,
        daysAgo: 3,
      })),
    );

    const o = observedLatency(getDb(), modelRowId, { now: NOW });
    const blended = blendedSpeedScore(o, 98);

    expect(o?.samples).toBe(40);
    expect(o?.p95Ms).toBeGreaterThan(o?.p50Ms as number);
    expect(blended).toBeLessThan(50);
  });
});
