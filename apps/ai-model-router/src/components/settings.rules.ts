import {
  PRICING_STALE_DAYS_MAX,
  PRICING_STALE_DAYS_MIN,
} from "@/lib/pricing-freshness";

export function budgetIdFrom(label: string, period: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || period;
}

export function parseModelList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface KeyVerifyOutcome {
  message: string;
  ok: boolean;
}

export function keyVerifyStatus(
  body: { certainty?: string; ok?: boolean; error?: string } | null,
  httpStatus: number,
): KeyVerifyOutcome {
  const j = body ?? {};
  if (j.certainty === "unknown")
    return { message: `unverified: ${j.error ?? "transient error"}`, ok: false };
  if (j.ok) return { message: "verified ok", ok: true };
  return { message: `failed: ${j.error ?? httpStatus}`, ok: false };
}

export type BudgetStatus = "ok" | "warning" | "exceeded" | "other";

export function budgetStatusTone(
  status: string,
): { cls: string; label: string } {
  if (status === "exceeded")
    return {
      cls: "rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400",
      label: status,
    };
  if (status === "warning")
    return {
      cls: "rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400",
      label: status,
    };
  if (status === "ok")
    return {
      cls: "rounded bg-green-500/15 px-2 py-0.5 text-xs text-green-500",
      label: status,
    };
  return {
    cls: "rounded bg-[var(--panel-2)] px-2 py-0.5 text-xs text-[var(--fg-dim)]",
    label: status,
  };
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Parses the pricing-stale-days draft input. Returns the integer when it
 * is inside 1..365, null otherwise so the UI can demand a fix instead of
 * silently clamping what the user typed.
 */
export function pricingStaleDaysValue(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  if (n < PRICING_STALE_DAYS_MIN || n > PRICING_STALE_DAYS_MAX) return null;
  return n;
}
