import { getSetting, setSetting } from "./db";
import {
  isUsableFetchedAt,
  type PricingFreshnessRecord,
} from "./pricing-freshness";

const FRESHNESS_KEY = "pricing_freshness";
// Same bound as pricing-audit: enough sources for a fleet, bounded writes.
const FRESHNESS_MAX_SOURCES = 50;

/**
 * The catalog cache timestamp under CATALOG_TS_KEY is the same value
 * /api/pricing reports as cachedAt. Keeping the "openrouter" record in
 * step with it makes the badge, /api/health and /api/export agree on one
 * truth instead of two clocks.
 */
export const CATALOG_SOURCE = "openrouter";
export const CATALOG_TS_KEY = "openrouter_catalog_ts";

function readRecords(): PricingFreshnessRecord[] {
  const raw = getSetting(FRESHNESS_KEY, "[]");
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PricingFreshnessRecord[]) : [];
  } catch {
    return [];
  }
}

/**
 * Readers must always see a record for the catalog source: before the
 * first successful fetch (or for upgrades from before the record map
 * existed) it is backfilled from the cache timestamp and persisted, and a
 * source that never got a table reports fetchedAt: null so a month of
 * failed refreshes still shows up as missing.
 */
export function getPricingFreshnessRecords(): PricingFreshnessRecord[] {
  const records = readRecords();
  if (records.some((r) => r.source === CATALOG_SOURCE)) return records;
  const ts = Number(getSetting(CATALOG_TS_KEY, "0"));
  if (isUsableFetchedAt(ts)) {
    const backfilled = [...records, { source: CATALOG_SOURCE, fetchedAt: ts }];
    setSetting(FRESHNESS_KEY, JSON.stringify(backfilled));
    return backfilled;
  }
  return [{ source: CATALOG_SOURCE, fetchedAt: null }, ...records];
}

export function getFreshnessRecord(
  source: string,
): PricingFreshnessRecord | undefined {
  return getPricingFreshnessRecords().find((r) => r.source === source);
}

/**
 * Evicts least-recently-updated records first, with never-fetched records
 * (null) treated as the oldest, so an actively refreshed source never
 * loses its slot just because it was pushed first.
 */
function evictStaleRecords(
  records: PricingFreshnessRecord[],
): PricingFreshnessRecord[] {
  const overflow = records.length - FRESHNESS_MAX_SOURCES;
  if (overflow <= 0) return records;
  const dropIdx = records
    .map((r, i) => ({
      i,
      ts: isUsableFetchedAt(r.fetchedAt) ? r.fetchedAt : Number.NEGATIVE_INFINITY,
    }))
    .sort((a, b) => a.ts - b.ts || a.i - b.i)
    .slice(0, overflow)
    .map((e) => e.i);
  const drop = new Set(dropIdx);
  return records.filter((_, i) => !drop.has(i));
}

export function updateFreshnessRecord(
  source: string,
  fetchedAt: number | null,
): void {
  const records = readRecords();
  const idx = records.findIndex((r) => r.source === source);
  if (idx >= 0) records[idx] = { source, fetchedAt };
  else records.push({ source, fetchedAt });
  setSetting(FRESHNESS_KEY, JSON.stringify(evictStaleRecords(records)));
}
