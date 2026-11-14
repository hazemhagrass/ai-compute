"use client";

import { useEffect, useState } from "react";

import { api } from "./store";
import {
  clampPricingStaleDays,
  freshnessState,
  pricingAgeDays,
  PRICING_STALE_DAYS_DEFAULT,
  type FreshnessState,
} from "@/lib/pricing-freshness";

/**
 * Badge colour tokens: amber maps to --warn, red to --bad, and a fresh
 * table stays neutral so the row inherits the surrounding text colour.
 */
export function freshnessColor(state: FreshnessState): string | undefined {
  if (state === "red") return "var(--bad)";
  if (state === "amber") return "var(--warn)";
  return undefined;
}

/** Whole days in words: "today" for a partial day, "never" for no table. */
export function pricingAgeLabel(
  fetchedAt: number | null,
  now: number,
): string {
  if (fetchedAt === null || !Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    return "never";
  }
  const days = pricingAgeDays(fetchedAt, now);
  return days === 0 ? "today" : `${days} days ago`;
}

export interface PricingFreshnessBadgeViewProps {
  fetchedAt: number | null;
  now: number;
  staleDays: number;
  prefix?: string;
}

export function PricingFreshnessBadgeView({
  fetchedAt,
  now,
  staleDays,
  prefix = "Pricing updated: ",
}: PricingFreshnessBadgeViewProps) {
  const state = freshnessState(fetchedAt, now, staleDays);
  const color = freshnessColor(state);
  const stale = state === "amber" || state === "red";
  return (
    <div className="text-xs" data-freshness={state}>
      <span className="text-[var(--fg-dim)]">{prefix}</span>
      <span style={color ? { color } : undefined}>
        {pricingAgeLabel(fetchedAt, now)}
      </span>
      {stale && (
        <span className="ml-2" style={color ? { color } : undefined}>
          stale
        </span>
      )}
    </div>
  );
}

/**
 * Self-fetching badge shared by the Models and Settings (budgets) panels:
 * the table timestamp comes from /api/pricing, the threshold from
 * /api/settings. Bumping refreshToken re-reads both after a price sync.
 */
export default function PricingFreshnessBadge({
  refreshToken = 0,
  prefix,
}: {
  refreshToken?: number;
  prefix?: string;
}) {
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [staleDays, setStaleDays] = useState(PRICING_STALE_DAYS_DEFAULT);
  const [nowTs] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    api<{ cachedAt: string }>("/api/pricing")
      .then((r) => {
        if (!cancelled) setCachedAt(r.cachedAt);
      })
      .catch(() => {});
    api<{ settings?: { pricingStaleDays: number } }>("/api/settings")
      .then((r) => {
        if (cancelled) return;
        if (typeof r.settings?.pricingStaleDays === "number") {
          setStaleDays(clampPricingStaleDays(r.settings.pricingStaleDays));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  if (cachedAt === null) return null;
  const fetchedAt = new Date(cachedAt).getTime();

  return (
    <PricingFreshnessBadgeView
      fetchedAt={fetchedAt}
      now={nowTs}
      staleDays={staleDays}
      prefix={prefix}
    />
  );
}
