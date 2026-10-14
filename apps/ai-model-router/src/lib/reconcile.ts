import { getDb } from "./db";

export interface InvoiceLine {
  modelId: string;
  billedUsd: number;
}

export interface ReconcileInput {
  providerSlug: string;
  start: string;
  end: string;
  lines: InvoiceLine[];
}

export interface LineResult {
  modelId: string;
  billedCents: number;
  computedCents: number;
  varianceCents: number;
  variancePct: number | null;
  unbilled: boolean;
}

export interface ReconcileResult {
  providerSlug: string;
  start: string;
  end: string;
  lines: LineResult[];
  unmatchedInvoice: string[];
  totalBilledCents: number;
  totalComputedCents: number;
  totalVarianceCents: number;
}

function toCents(usd: number): number {
  return Number.isFinite(usd) && usd > 0 ? Math.round(usd * 100) : 0;
}

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
