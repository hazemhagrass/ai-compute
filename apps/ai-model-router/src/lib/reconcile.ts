import { getDb } from "./db";

/**
 * Reconcile a provider invoice against the cost the router computed.
 *
 * The router's cost is an estimate from token counts and published prices. The
 * invoice is what the provider actually charged. Reconciliation answers "did
 * my estimate match the bill" per model and in total, and surfaces both
 * directions of drift: an invoice line we have no usage for, and computed
 * spend that never made it onto the bill.
 *
 * Money is handled in integer cents: floats accumulate rounding error exactly
 * where a reconciliation is supposed to detect it.
 */

export interface InvoiceLine {
  /** The provider-side model id, matched against usage.model_id. */
  modelId: string;
  /** What the provider charged for this model in the period, in USD. */
  billedUsd: number;
}

export interface ReconcileInput {
  providerSlug: string;
  /** Inclusive period start, "YYYY-MM-DD". */
  start: string;
  /** Inclusive period end, "YYYY-MM-DD". */
  end: string;
  lines: InvoiceLine[];
}

export interface LineResult {
  modelId: string;
  billedCents: number;
  computedCents: number;
  /** billed minus computed; positive means the bill exceeded the estimate. */
  varianceCents: number;
  /** Variance as a fraction of billed, or null when billed is zero. */
  variancePct: number | null;
  /** True when we recorded usage but the invoice has no line for the model. */
  unbilled: boolean;
}

export interface ReconcileResult {
  providerSlug: string;
  start: string;
  end: string;
  lines: LineResult[];
  /** Invoice lines with no recorded usage in the period. */
  unmatchedInvoice: string[];
  totalBilledCents: number;
  totalComputedCents: number;
  totalVarianceCents: number;
}

function toCents(usd: number): number {
  // Guard NaN/negative the same way computeCost does: a malformed line must
  // not poison the totals.
  return Number.isFinite(usd) && usd > 0 ? Math.round(usd * 100) : 0;
}

/**
 * Sum computed spend per model id for a provider over a UTC date range.
 * usage_events.ts is datetime('now'), so comparisons are date strings in UTC.
 */
function computedSpendByModel(
  providerSlug: string,
  start: string,
  end: string,
): Map<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT model_id, SUM(cost_usd) AS cost
         FROM usage_events
        WHERE provider_slug = ?
          AND ts >= ? || ' 00:00:00'
          AND ts <= ? || ' 23:59:59'
        GROUP BY model_id`,
    )
    .all(providerSlug, start, end) as { model_id: string; cost: number }[];
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.model_id, toCents(r.cost));
  return map;
}

export function reconcile(input: ReconcileInput): ReconcileResult {
  const computed = computedSpendByModel(input.providerSlug, input.start, input.end);
  const seen = new Set<string>();
  const lines: LineResult[] = [];
  let totalBilled = 0;

  for (const line of input.lines) {
    seen.add(line.modelId);
    const billed = toCents(line.billedUsd);
    const got = computed.get(line.modelId) ?? 0;
    totalBilled += billed;
    lines.push({
      modelId: line.modelId,
      billedCents: billed,
      computedCents: got,
      varianceCents: billed - got,
      variancePct: billed > 0 ? (billed - got) / billed : null,
      unbilled: false,
    });
  }

  // Computed spend that never appeared on the invoice.
  for (const [modelId, cents] of computed) {
    if (seen.has(modelId)) continue;
    lines.push({
      modelId,
      billedCents: 0,
      computedCents: cents,
      varianceCents: -cents,
      variancePct: null,
      unbilled: true,
    });
  }

  const unmatchedInvoice = input.lines
    .filter((l) => !computed.has(l.modelId))
    .map((l) => l.modelId);

  const totalComputed = lines.reduce((s, l) => s + l.computedCents, 0);
  return {
    providerSlug: input.providerSlug,
    start: input.start,
    end: input.end,
    lines,
    unmatchedInvoice,
    totalBilledCents: totalBilled,
    totalComputedCents: totalComputed,
    totalVarianceCents: totalBilled - totalComputed,
  };
}
