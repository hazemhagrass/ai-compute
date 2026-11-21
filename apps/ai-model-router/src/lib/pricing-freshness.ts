export const PRICING_STALE_DAYS_DEFAULT = 14;
export const PRICING_STALE_DAYS_MIN = 1;
export const PRICING_STALE_DAYS_MAX = 365;

export type FreshnessState = "ok" | "amber" | "red";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The one usable-timestamp predicate every freshness consumer shares:
 * null, zero, negative and NaN all mean the table is missing or
 * nonsensical. Keeping this in one place is what makes the badge, health
 * and export agree on the same null/NaN semantics.
 */
export function isUsableFetchedAt(ts: number | null): ts is number {
  return ts !== null && Number.isFinite(ts) && ts > 0;
}

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
 * Whole days elapsed since ts, floored. An unusable timestamp means
 * "never fetched" and reports an infinite age.
 */
export function pricingAgeDays(ts: number, now: number): number {
  if (!isUsableFetchedAt(ts)) return Number.POSITIVE_INFINITY;
  return Math.floor((now - ts) / DAY_MS);
}

export function isPricingStale(ts: number, now: number, days: number): boolean {
  // Millisecond-precise on purpose: a 14-day threshold must flag 14d+1ms.
  // pricingAgeDays floors for display; staleness compares raw elapsed ms.
  if (!isUsableFetchedAt(ts)) return true;
  return now - ts > days * DAY_MS;
}

/**
 * ok: fetched within staleDays. amber: older than staleDays.
 * red: missing or nonsensical timestamp (null, zero, negative, NaN).
 * Amber starts immediately past the threshold: staleness compares raw
 * elapsed ms, so 1ms past staleDays already flags. The displayed age
 * is what floors to whole days.
 */
export function freshnessState(
  fetchedAt: number | null,
  now: number,
  staleDays: number,
): FreshnessState {
  if (!isUsableFetchedAt(fetchedAt)) {
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
    if (!isUsableFetchedAt(r.fetchedAt)) {
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
