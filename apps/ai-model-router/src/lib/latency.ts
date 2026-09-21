import type BetterSqlite3 from "better-sqlite3";

/**
 * Real observed latency for a model, derived from recorded usage_events.
 *
 * Ticket #12: models ship with a hand-written `speed` score. That number is a
 * guess made once by a human, while real latency moves with the provider, the
 * region and the time of day. Anything we can measure, we should measure.
 */

/** Below this many samples a percentile is noise, so we report nothing. */
export const MIN_SAMPLES = 5;

/** Only the recent past counts: a provider that got faster deserves credit. */
export const DEFAULT_WINDOW_DAYS = 30;

/**
 * Sample count at which observed data fully replaces the declared score.
 * Between MIN_SAMPLES and here the two are mixed, so a model does not lurch
 * from pure guess to pure measurement on the strength of its fifth call.
 */
export const FULL_CONFIDENCE_SAMPLES = 20;

/** A p95 at or under this is as good as instant, and scores 100. */
export const FAST_P95_MS = 250;

/** A p95 at or over this is unusable for interactive work, and scores 0. */
export const SLOW_P95_MS = 30_000;

/** Tokens per second at which throughput stops earning more credit. */
export const FAST_TOKENS_PER_SEC = 200;

/**
 * Latency dominates the blend because it is what a user feels on the first
 * keystroke of output. Throughput only matters once the stream has started.
 */
export const LATENCY_WEIGHT = 0.7;

export interface ObservedLatency {
  /** Number of usable samples inside the window. */
  samples: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  /** Median, not mean, for the same reason the latencies are percentiles. */
  medianTokensPerSec: number;
  /** Lower bound of the window, as stored in usage_events.ts. */
  since: string;
  windowDays: number;
}

export interface ObservedLatencyOptions {
  /** Recency window in days (default DEFAULT_WINDOW_DAYS). */
  windowDays?: number;
  /** Minimum usable samples before any number is returned (default MIN_SAMPLES). */
  minSamples?: number;
  /** Injectable clock, so window tests do not depend on wall time. */
  now?: Date;
}

interface LatencyRow {
  latency_ms: number;
  tokens_per_sec: number;
}

/** usage_events.ts is written by datetime('now'), i.e. "YYYY-MM-DD HH:MM:SS" UTC. */
function toSqliteTs(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Nearest-rank percentile.
 *
 * We deliberately do NOT interpolate between neighbouring samples: every
 * figure we publish should be a latency that an actual request actually took,
 * not an arithmetic artefact sitting between two of them.
 *
 * `sorted` must be ascending and non-empty.
 */
export function percentile(sorted: number[], q: number): number {
  const rank = Math.ceil((q / 100) * sorted.length);
  // q <= 0 would rank 0, and floating point can push ceil() one past the end.
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] as number;
}

/**
 * Percentiles over what this model really did, or null when we cannot say.
 *
 * Percentiles rather than an average throughout: the mean is dragged down by
 * the many fast calls and so hides exactly the slow ones a user notices and
 * complains about. A model with a 300ms mean and a 12s p95 feels broken, and
 * only the p95 says so.
 */
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
      // ok = 1 because a request that failed measures the failure, not the
      // model's speed; latency_ms > 0 because an unrecorded timing is a zero
      // in the column and would otherwise look like the fastest call ever.
      `SELECT latency_ms, tokens_per_sec
         FROM usage_events
        WHERE model_row_id = ?
          AND ts >= ?
          AND ok = 1
          AND latency_ms > 0
        ORDER BY latency_ms ASC`,
    )
    .all(modelRowId, since) as LatencyRow[];

  // An honest absence beats a confident wrong number: two samples cannot
  // support a p95, and a caller shown one would trust it as though they could.
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
    // Calls that produced no output tokens have no meaningful throughput and
    // are excluded rather than counted as zero, which would halve the median.
    medianTokensPerSec: tps.length > 0 ? percentile(tps, 50) : 0,
    since,
    windowDays,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Map an observed p95 onto 0-100.
 *
 * Interpolated on a log scale because latency is perceived multiplicatively:
 * 250ms to 500ms is the same felt step down as 5s to 10s, and a linear scale
 * would flatten every interactive-grade model into the same top few points.
 */
function latencyToScore(p95Ms: number): number {
  if (p95Ms <= FAST_P95_MS) return 100;
  if (p95Ms >= SLOW_P95_MS) return 0;
  const span = Math.log(SLOW_P95_MS) - Math.log(FAST_P95_MS);
  return 100 * (1 - (Math.log(p95Ms) - Math.log(FAST_P95_MS)) / span);
}

/** Observed speed on the same 0-100 scale as the hand-written `speed` column. */
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

/**
 * Prefer what we measured, fall back to what a human guessed.
 *
 * A brand-new model has no history at all, and the router still has to rank it
 * today. Rather than score it 0 (never chosen, so never measured, so never
 * scored) we lean on the declared number and hand weight over to real data as
 * the samples accumulate.
 */
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
