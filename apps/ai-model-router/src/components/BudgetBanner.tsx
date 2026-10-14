"use client";

export interface BudgetBlock {
  id: string;
  period: string;
  limitCents: number;
  spentCents: number;
}

export function BudgetWarning({ percent }: { percent: number }) {
  return (
    <div className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-2 text-xs text-[var(--warn)]">
      Budget at {percent}% for this period -- calls will be refused once it
      reaches 100%. Raise the limit in Settings or wait for the next period.
    </div>
  );
}

export function BudgetBlocked({ budget }: { budget: BudgetBlock }) {
  return (
    <div className="rounded-lg border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-3 py-2 text-xs text-[var(--bad)]">
      <div className="font-medium">Call refused: {budget.id} budget exceeded</div>
      <div className="mt-0.5 text-[var(--fg-muted)]">
        {budget.period} budget: ${(budget.spentCents / 100).toFixed(2)} spent of $
        {(budget.limitCents / 100).toFixed(2)}. Raise the limit in Settings or
        wait for the next period.
      </div>
    </div>
  );
}

export function budgetWarningFrom(res: Response): number | null {
  const raw = res.headers.get("x-budget-warning");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function budgetBlockFromValue(body: unknown): BudgetBlock | null {
  const j = body as { budget?: BudgetBlock } | null;
  return j?.budget ?? null;
}

export async function budgetBlockFrom(res: Response): Promise<BudgetBlock | null> {
  const j = (await res.json().catch(() => null)) as {
    budget?: BudgetBlock;
  } | null;
  if (!j?.budget) return null;
  return j.budget;
}
