import type BetterSqlite3 from "better-sqlite3";
import { z } from "zod";

import { getSetting, setSetting } from "./db";

type Db = BetterSqlite3.Database;

/*
 * TIMEZONE ASSUMPTION
 * -------------------
 * usage_events.ts is written by SQLite's datetime('now'), which is always UTC
 * in the "YYYY-MM-DD HH:MM:SS" form. Every period boundary here is therefore
 * computed in UTC too. Mixing a local-time boundary with UTC-stamped rows
 * would shift the reset by the host's offset and silently misattribute up to a
 * full day of spend to the wrong period, which is exactly the failure mode a
 * budget alert is supposed to prevent.
 */

/*
 * MONEY
 * -----
 * All arithmetic is on integers. Limits are integer cents. Spend is summed
 * inside SQLite as integer MILLICENTS (1/1000 of a cent) so that sub-cent
 * calls, which are the common case for cheap models, are not rounded away one
 * row at a time. Integer addition is exact, so the only rounding happens once,
 * when millicents are converted to cents for the caller.
 */
const MILLICENTS_PER_CENT = 1000;
const MILLICENTS_PER_USD = 100 * MILLICENTS_PER_CENT;

/** Thresholds, in percent, that raise an alert. Ascending order matters. */
export const ALERT_THRESHOLDS = [50, 80, 100] as const;
export type AlertThreshold = (typeof ALERT_THRESHOLDS)[number];

/** Percent at which a budget is called a warning even without a projection. */
const WARNING_PERCENT = 80;

export type BudgetPeriod = "daily" | "weekly" | "monthly";
export type BudgetStatus = "ok" | "warning" | "exceeded";

export const budgetSchema = z.object({
  id: z.string().min(1),
  label: z.string().default(""),
  period: z.enum(["daily", "weekly", "monthly"]),
  /** Integer cents. Floats are refused at the boundary so none can get in. */
  limitCents: z.number().int().nonnegative(),
  /** 0 = Sunday ... 6 = Saturday. Only meaningful for a weekly period. */
  weekStartsOn: z.number().int().min(0).max(6).default(1),
});

export type Budget = z.infer<typeof budgetSchema>;

export interface BudgetPeriodWindow {
  /** Inclusive lower bound, "YYYY-MM-DD HH:MM:SS" UTC. */
  start: string;
  /** Exclusive upper bound, "YYYY-MM-DD HH:MM:SS" UTC. */
  end: string;
  /** Stable identity of this period. A change here re-arms every alert. */
  key: string;
}

export interface BudgetEvaluation {
  budgetId: string;
  period: BudgetPeriod;
  window: BudgetPeriodWindow;
  limitCents: number;
  spentCents: number;
  remainingCents: number;
  /** 0-100+, not clamped: knowing you are at 140 percent is useful. */
  percentUsed: number;
  /** Spend extrapolated to the end of the period at the current burn rate. */
  projectedCents: number;
  /** Fraction of the period already elapsed, 0-1. */
  elapsedFraction: number;
  status: BudgetStatus;
}

export interface BudgetAlert {
  budgetId: string;
  threshold: AlertThreshold;
  periodKey: string;
  spentCents: number;
  limitCents: number;
  percentUsed: number;
  message: string;
}

/* ------------------------------------------------------------------ money */

/** Convert a USD float to integer cents. Used only at the input boundary. */
export function usdToCents(usd: number): number {
  if (!Number.isFinite(usd)) return 0;
  return Math.round(usd * 100);
}

/** Integer cents back to USD, for display only. Never feed this back in. */
export function centsToUsd(cents: number): number {
  return cents / 100;
}

/* ----------------------------------------------------------- period maths */

function toSqlTs(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** The period containing `now`, in UTC. See the timezone note at the top. */
export function periodWindow(budget: Budget, now: Date): BudgetPeriodWindow {
  if (budget.period === "daily") {
    const start = startOfUtcDay(now);
    const end = addUtcDays(start, 1);
    return { start: toSqlTs(start), end: toSqlTs(end), key: `d:${toSqlTs(start).slice(0, 10)}` };
  }

  if (budget.period === "weekly") {
    const day = startOfUtcDay(now);
    // Walk back to the configured start weekday. The modulo keeps the result
    // non-negative when today is before weekStartsOn in the week.
    const backwards = (day.getUTCDay() - budget.weekStartsOn + 7) % 7;
    const start = addUtcDays(day, -backwards);
    const end = addUtcDays(start, 7);
    return { start: toSqlTs(start), end: toSqlTs(end), key: `w:${toSqlTs(start).slice(0, 10)}` };
  }

  // Monthly resets on the 1st at 00:00:00 UTC. Date.UTC normalises month 12
  // into January of the next year, so December needs no special case.
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: toSqlTs(start), end: toSqlTs(end), key: `m:${toSqlTs(start).slice(0, 7)}` };
}

/* ------------------------------------------------------------ persistence */

const BUDGET_KEY = (id: string) => `budget:${id}`;
const ALERT_KEY = (id: string) => `budget:${id}:alerts`;
const INDEX_KEY = "budget:index";

function readIndex(): string[] {
  try {
    const parsed: unknown = JSON.parse(getSetting(INDEX_KEY, "[]"));
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function saveBudget(input: unknown): Budget {
  const budget = budgetSchema.parse(input);
  setSetting(BUDGET_KEY(budget.id), JSON.stringify(budget));
  const ids = readIndex();
  if (!ids.includes(budget.id)) setSetting(INDEX_KEY, JSON.stringify([...ids, budget.id]));
  return budget;
}

export function getBudget(id: string): Budget | null {
  const raw = getSetting(BUDGET_KEY(id), "");
  if (!raw) return null;
  try {
    return budgetSchema.parse(JSON.parse(raw));
  } catch {
    // A hand-edited or older settings row must not take the whole page down.
    return null;
  }
}

export function listBudgets(): Budget[] {
  return readIndex()
    .map(getBudget)
    .filter((b): b is Budget => b !== null);
}

export function deleteBudget(id: string): void {
  setSetting(BUDGET_KEY(id), "");
  setSetting(ALERT_KEY(id), "");
  setSetting(INDEX_KEY, JSON.stringify(readIndex().filter((x) => x !== id)));
}

interface AlertState {
  periodKey: string;
  fired: number[];
}

function readAlertState(id: string, periodKey: string): AlertState {
  const raw = getSetting(ALERT_KEY(id), "");
  if (!raw) return { periodKey, fired: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<AlertState>;
    // A different period key means a rollover happened, so every threshold
    // re-arms. This is what makes alerts once-per-threshold-per-period rather
    // than once ever.
    if (parsed.periodKey !== periodKey) return { periodKey, fired: [] };
    return {
      periodKey,
      fired: Array.isArray(parsed.fired) ? parsed.fired.filter((n) => typeof n === "number") : [],
    };
  } catch {
    return { periodKey, fired: [] };
  }
}

function writeAlertState(id: string, state: AlertState): void {
  setSetting(ALERT_KEY(id), JSON.stringify(state));
}

/** Thresholds already alerted on in the current period. */
export function firedThresholds(budget: Budget, now: Date): number[] {
  return readAlertState(budget.id, periodWindow(budget, now).key).fired;
}

/** Drop the fired record so alerts re-arm. Exposed for manual "snooze off". */
export function resetBudgetAlerts(id: string): void {
  setSetting(ALERT_KEY(id), "");
}

/* -------------------------------------------------------------- evaluation */

/** Integer millicents spent in [start, end). Summed as integers inside SQL. */
function spentMillicents(db: Db, window: BudgetPeriodWindow): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(ROUND(cost_usd * ${MILLICENTS_PER_USD}) AS INTEGER)), 0) AS millicents
       FROM usage_events
       WHERE ts >= ? AND ts < ?`,
    )
    .get(window.start, window.end) as { millicents: number };
  return row.millicents ?? 0;
}

export function evaluateBudget(db: Db, budget: Budget, now: Date): BudgetEvaluation {
  const window = periodWindow(budget, now);
  const spentCents = Math.round(spentMillicents(db, window) / MILLICENTS_PER_CENT);

  const startMs = Date.parse(`${window.start.replace(" ", "T")}Z`);
  const endMs = Date.parse(`${window.end.replace(" ", "T")}Z`);
  const span = endMs - startMs;
  const elapsedRaw = (now.getTime() - startMs) / span;
  const elapsedFraction = Math.min(1, Math.max(0, elapsedRaw));

  // Extrapolating from a near-zero slice of the period produces an absurd
  // number, so the first moments of a period project flat instead. Once past
  // that floor the projection is a straight linear burn rate.
  const MIN_ELAPSED_FOR_PROJECTION = 0.01;
  const projectedCents =
    elapsedFraction >= MIN_ELAPSED_FOR_PROJECTION
      ? Math.round(spentCents / elapsedFraction)
      : spentCents;

  const percentUsed = budget.limitCents > 0 ? (spentCents / budget.limitCents) * 100 : 0;

  let status: BudgetStatus = "ok";
  if (budget.limitCents > 0 && spentCents >= budget.limitCents) status = "exceeded";
  else if (
    budget.limitCents > 0 &&
    (percentUsed >= WARNING_PERCENT || projectedCents > budget.limitCents)
  )
    status = "warning";

  return {
    budgetId: budget.id,
    period: budget.period,
    window,
    limitCents: budget.limitCents,
    spentCents,
    remainingCents: budget.limitCents - spentCents,
    percentUsed,
    projectedCents,
    elapsedFraction,
    status,
  };
}

export interface BudgetCheck {
  evaluation: BudgetEvaluation;
  /** Thresholds crossed for the FIRST time in this period, ascending. */
  alerts: BudgetAlert[];
}

/**
 * Evaluate and fire any not-yet-fired threshold alerts, recording them so the
 * next call in the same period stays silent. Re-alerting on every request
 * trains the user to ignore the alert, which defeats the whole feature.
 */
export function checkBudget(db: Db, budget: Budget, now: Date): BudgetCheck {
  const evaluation = evaluateBudget(db, budget, now);
  const state = readAlertState(budget.id, evaluation.window.key);

  const alerts: BudgetAlert[] = [];
  if (budget.limitCents > 0) {
    for (const threshold of ALERT_THRESHOLDS) {
      if (evaluation.percentUsed < threshold) continue;
      if (state.fired.includes(threshold)) continue;
      state.fired.push(threshold);
      alerts.push({
        budgetId: budget.id,
        threshold,
        periodKey: evaluation.window.key,
        spentCents: evaluation.spentCents,
        limitCents: budget.limitCents,
        percentUsed: evaluation.percentUsed,
        message:
          threshold === 100
            ? `Budget "${budget.label || budget.id}" is exhausted: $${centsToUsd(evaluation.spentCents).toFixed(2)} of $${centsToUsd(budget.limitCents).toFixed(2)} this ${budget.period.replace("ly", "")}.`
            : `Budget "${budget.label || budget.id}" passed ${threshold}%: $${centsToUsd(evaluation.spentCents).toFixed(2)} of $${centsToUsd(budget.limitCents).toFixed(2)}.`,
      });
    }
  }

  // Always persist, even with no new alerts, so a rollover-cleared state is
  // written back rather than re-read and re-cleared on every call.
  writeAlertState(budget.id, state);

  return { evaluation, alerts };
}
