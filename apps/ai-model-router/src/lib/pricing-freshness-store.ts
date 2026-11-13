import { getSetting, setSetting } from "./db";
import type { PricingFreshnessRecord } from "./pricing-freshness";

const FRESHNESS_KEY = "pricing_freshness";
// Same bound as pricing-audit: enough sources for a fleet, bounded writes.
const FRESHNESS_MAX_SOURCES = 50;

/**
 * Per-source freshness map, one record per pricing source: when its table
 * was last fetched (null = never). Stored as JSON under one settings key.
 */
export function getPricingFreshnessRecords(): PricingFreshnessRecord[] {
  const raw = getSetting(FRESHNESS_KEY, "[]");
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PricingFreshnessRecord[]) : [];
  } catch {
    return [];
  }
}

export function getFreshnessRecord(
  source: string,
): PricingFreshnessRecord | undefined {
  return getPricingFreshnessRecords().find((r) => r.source === source);
}

export function updateFreshnessRecord(
  source: string,
  fetchedAt: number | null,
): void {
  const records = getPricingFreshnessRecords();
  const idx = records.findIndex((r) => r.source === source);
  if (idx >= 0) records[idx] = { source, fetchedAt };
  else records.push({ source, fetchedAt });
  setSetting(
    FRESHNESS_KEY,
    JSON.stringify(records.slice(-FRESHNESS_MAX_SOURCES)),
  );
}
