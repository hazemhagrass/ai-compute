const DAY_MS = 24 * 60 * 60 * 1000;

export const PRICING_STALE_DAYS = 30;

export function pricingAgeDays(ts: number, now: number): number {
  if (ts <= 0) return Number.POSITIVE_INFINITY;
  return Math.floor((now - ts) / DAY_MS);
}

export function isPricingStale(ts: number, now: number, days: number): boolean {
  if (ts === 0) return true;
  return now - ts > days * DAY_MS;
}
