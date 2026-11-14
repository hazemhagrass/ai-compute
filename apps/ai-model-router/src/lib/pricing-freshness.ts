export const PRICING_STALE_DAYS_DEFAULT = 14;
export const PRICING_STALE_DAYS_MIN = 1;
export const PRICING_STALE_DAYS_MAX = 365;

export type FreshnessState = "ok" | "amber" | "red";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PricingFreshnessRecord {
  source: string;
  fetchedAt: number | null;
}

/**
 * Accepts user input for the stale-days setting and clamps it into the
 * valid range. Unparseable input falls back to the default instead of
 * silently storing an unusable value.
 */
export function clampPricingStaleDays(v: unknown): number {
  const n =
    typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return PRICING_STALE_DAYS_DEFAULT;
  return Math.min(
    PRICING_STALE_DAYS_MAX,
    Math.max(PRICING_STALE_DAYS_MIN, Math.trunc(n)),
  );
}

/**
 * Whole days elapsed since ts, floored. Non-finite or non-positive
 * timestamps mean "never fetched" and report an infinite age.
 */
export function pricingAgeDays(ts: number, now: number): number {
  if (!Number.isFinite(ts) || ts <= 0) return Number.POSITIVE_INFINITY;
  return Math.floor((now - ts) / DAY_MS);
}

export function isPricingStale(ts: number, now: number, days: number): boolean {
  // Millisecond-precise on purpose: a 14-day threshold must flag 14d+1ms.
  // pricingAgeDays floors for display; staleness compares raw elapsed ms.
  if (!Number.isFinite(ts) || ts <= 0) return true;
  return now - ts > days * DAY_MS;
}

/**
 * ok: fetched within staleDays. amber: older than staleDays.
 * red: missing or nonsensical timestamp (null, zero, negative, NaN).
 * Amber starts one day past the threshold: exactly staleDays is still ok.
 */
export function freshnessState(
  fetchedAt: number | null,
  now: number,
  staleDays: number,
): FreshnessState {
  if (fetchedAt === null || !Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    return "red";
  }
  if (isPricingStale(fetchedAt, now, staleDays)) return "amber";
  return "ok";
}

export interface PricingFreshnessSummary {
  oldestAgeDays: number | null;
  oldestSource: string | null;
  missing: string[];
}

/**
 * Whole-fleet view over the per-source records: the oldest table age in
 * floor-of-days, the source it belongs to, and every source whose table is
 * missing or nonsensical. Ties keep the first source; a missing table never
 * counts as the oldest.
 */
export function summarizePricingFreshness(
  records: PricingFreshnessRecord[],
  now: number,
): PricingFreshnessSummary {
  let oldestAgeDays: number | null = null;
  let oldestSource: string | null = null;
  const missing: string[] = [];
  for (const r of records) {
    if (r.fetchedAt === null || !Number.isFinite(r.fetchedAt) || r.fetchedAt <= 0) {
      missing.push(r.source);
      continue;
    }
    const age = pricingAgeDays(r.fetchedAt, now);
    if (oldestAgeDays === null || age > oldestAgeDays) {
      oldestAgeDays = age;
      oldestSource = r.source;
    }
  }
  return { oldestAgeDays, oldestSource, missing };
}
