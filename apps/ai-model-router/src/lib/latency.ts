import type BetterSqlite3 from "better-sqlite3";

export const MIN_SAMPLES = 5;

export const DEFAULT_WINDOW_DAYS = 30;

export const FULL_CONFIDENCE_SAMPLES = 20;

export const FAST_P95_MS = 250;

export const SLOW_P95_MS = 30_000;

export const FAST_TOKENS_PER_SEC = 200;

export const LATENCY_WEIGHT = 0.7;

export interface ObservedLatency {
  samples: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  medianTokensPerSec: number;
  since: string;
  windowDays: number;
}

export interface ObservedLatencyOptions {
  windowDays?: number;
  minSamples?: number;
  now?: Date;
}

interface LatencyRow {
  latency_ms: number;
  tokens_per_sec: number;
}

function toSqliteTs(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export function percentile(sorted: number[], q: number): number {
  const rank = Math.ceil((q / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] as number;
}

export function observedLatency(
  db: BetterSqlite3.Database,
  modelRowId: number,
  opts: ObservedLatencyOptions = {},
): ObservedLatency | null {
  const windowDays =
    Number.isFinite(opts.windowDays) && (opts.windowDays as number) > 0
      ? (opts.windowDays as number)
      : DEFAULT_WINDOW_DAYS;
  const minSamples = Math.max(
    1,
    Number.isFinite(opts.minSamples) ? (opts.minSamples as number) : MIN_SAMPLES,
  );
  const now = opts.now ?? new Date();
  const since = toSqliteTs(new Date(now.getTime() - windowDays * 86_400_000));

  const rows = db
    .prepare(
      `SELECT latency_ms, tokens_per_sec
         FROM usage_events
        WHERE model_row_id = ?
          AND ts >= ?
          AND ok = 1
          AND latency_ms > 0
        ORDER BY latency_ms ASC`,
    )
    .all(modelRowId, since) as LatencyRow[];

  if (rows.length < minSamples) return null;

  const latencies = rows.map((r) => r.latency_ms);
  const tps = rows
    .map((r) => r.tokens_per_sec)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  return {
    samples: latencies.length,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    medianTokensPerSec: tps.length > 0 ? percentile(tps, 50) : 0,
    since,
    windowDays,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function latencyToScore(p95Ms: number): number {
  if (p95Ms <= FAST_P95_MS) return 100;
  if (p95Ms >= SLOW_P95_MS) return 0;
  const span = Math.log(SLOW_P95_MS) - Math.log(FAST_P95_MS);
  return 100 * (1 - (Math.log(p95Ms) - Math.log(FAST_P95_MS)) / span);
}

export function observedSpeedScore(observed: ObservedLatency): number {
  const latencyScore = latencyToScore(observed.p95Ms);
  const throughputScore =
    clamp(observed.medianTokensPerSec / FAST_TOKENS_PER_SEC, 0, 1) * 100;
  return clamp(
    LATENCY_WEIGHT * latencyScore + (1 - LATENCY_WEIGHT) * throughputScore,
    0,
    100,
  );
}

export function blendedSpeedScore(
  observed: ObservedLatency | null,
  declaredScore: number,
): number {
  const declared = clamp(
    Number.isFinite(declaredScore) ? declaredScore : 0,
    0,
    100,
  );
  if (!observed) return declared;

  const confidence = clamp(observed.samples / FULL_CONFIDENCE_SAMPLES, 0, 1);
  const measured = observedSpeedScore(observed);
  return clamp(confidence * measured + (1 - confidence) * declared, 0, 100);
}
