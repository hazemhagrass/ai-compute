"use client";

import { useEffect, useState } from "react";

import { api } from "./store";
import {
  clampPricingStaleDays,
  freshnessState,
  isUsableFetchedAt,
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

/**
 * Whole days in words: "today" for a partial day (and a future timestamp
 * from clock skew, floored below zero), singular for one day, "never" for
 * no table.
 */
export function pricingAgeLabel(
  fetchedAt: number | null,
  now: number,
): string {
  if (!isUsableFetchedAt(fetchedAt)) {
    return "never";
  }
  const days = pricingAgeDays(fetchedAt, now);
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
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
 * /api/settings. Bumping refreshToken re-reads both after a price sync;
 * keying the badge on the saved pricingStaleDays re-reads it after a
 * settings save; window focus and tab visibility re-read it so a change
 * from another browser tab lands without a reload. The clock re-reads
 * every minute (and on a token bump) so a panel left open across midnight
 * still shows the right age.
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
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  // Ages are displayed in whole days: refresh the clock so a panel left
  // open across midnight stops showing yesterday's age.
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
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
    };
    load();
    // The threshold can also change in another browser tab of the same
    // account: this mounted badge never sees the save, so re-read both
    // fetches when the panel becomes visible again (window focus, tab
    // visibility) instead of coloring on the old value until a reload.
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
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
