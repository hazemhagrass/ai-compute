/**
 * Subscriptions and entitlements (issue #153).
 *
 * A subscription is the source of truth for what a user is allowed to call at
 * a given provider. Entitlement filtering asks a simple question of every
 * model: is the user allowed to call it right now, and if not, why. The "why"
 * is preserved so the UI can explain, and the ranker can honour it.
 */
import { z } from "zod";

import { getDb } from "./db";
import type { BudgetEvaluation } from "./budget";

export const subscriptionSchema = z.object({
  providerId: z.number().int().positive(),
  tier: z.string().trim().min(1).default("free"),
  allowModels: z.array(z.string()).default([]),
  denyModels: z.array(z.string()).default([]),
  monthlyInput: z.number().int().min(0).default(0),
  monthlyOutput: z.number().int().min(0).default(0),
  monthlyBudget: z.number().min(0).default(0),
  notes: z.string().default(""),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export const subscriptionInputSchema = subscriptionSchema.partial({
  tier: true,
  allowModels: true,
  denyModels: true,
  monthlyInput: true,
  monthlyOutput: true,
  monthlyBudget: true,
  notes: true,
});

export type SubscriptionInput = z.infer<typeof subscriptionInputSchema>;


interface Row {
  provider_id: number;
  tier: string;
  allow_models_json: string;
  deny_models_json: string;
  monthly_input: number;
  monthly_output: number;
  monthly_budget: number;
  notes: string;
}

function rowToSub(r: Row): Subscription {
  return subscriptionSchema.parse({
    providerId: r.provider_id,
    tier: r.tier,
    allowModels: JSON.parse(r.allow_models_json || "[]"),
    denyModels: JSON.parse(r.deny_models_json || "[]"),
    monthlyInput: r.monthly_input,
    monthlyOutput: r.monthly_output,
    monthlyBudget: r.monthly_budget,
    notes: r.notes,
  });
}

export function listSubscriptions(): Subscription[] {
  return getDb()
    .prepare("SELECT * FROM subscriptions ORDER BY provider_id")
    .all()
    .map((r) => rowToSub(r as Row));
}

export function getSubscription(providerId: number): Subscription | null {
  const r = getDb()
    .prepare("SELECT * FROM subscriptions WHERE provider_id = ?")
    .get(providerId) as Row | undefined;
  return r ? rowToSub(r) : null;
}

export function upsertSubscription(input: SubscriptionInput): Subscription {
  const parsed = subscriptionSchema.parse({
    providerId: input.providerId,
    tier: input.tier ?? "free",
    allowModels: input.allowModels ?? [],
    denyModels: input.denyModels ?? [],
    monthlyInput: input.monthlyInput ?? 0,
    monthlyOutput: input.monthlyOutput ?? 0,
    monthlyBudget: input.monthlyBudget ?? 0,
    notes: input.notes ?? "",
  });
  getDb()
    .prepare(
      "INSERT INTO subscriptions (provider_id, tier, allow_models_json, deny_models_json, monthly_input, monthly_output, monthly_budget, notes, updated_at) " +
        "VALUES (?,?,?,?,?,?,?,?,datetime('now')) " +
        "ON CONFLICT(provider_id) DO UPDATE SET tier=excluded.tier, allow_models_json=excluded.allow_models_json, deny_models_json=excluded.deny_models_json, monthly_input=excluded.monthly_input, monthly_output=excluded.monthly_output, monthly_budget=excluded.monthly_budget, notes=excluded.notes, updated_at=datetime('now')",
    )
    .run(
      parsed.providerId,
      parsed.tier,
      JSON.stringify(parsed.allowModels),
      JSON.stringify(parsed.denyModels),
      parsed.monthlyInput,
      parsed.monthlyOutput,
      parsed.monthlyBudget,
      parsed.notes,
    );
  return parsed;
}

export function deleteSubscription(providerId: number): boolean {
  const res = getDb()
    .prepare("DELETE FROM subscriptions WHERE provider_id = ?")
    .run(providerId);
  return res.changes > 0;
}

/**
 * Reason a specific model is not currently reachable.
 * The set is closed so the UI can render each case distinctly.
 */
export type EntitlementReason =
  | "no-subscription"
  | "provider-disabled"
  | "not-in-allow-list"
  | "in-deny-list"
  | "budget-exhausted"
  | "quota-exhausted";

export interface EntitlementCheck {
  allowed: boolean;
  reason?: EntitlementReason;
  explanation?: string;
}

/**
 * Decide whether a model is reachable given the current subscription for its
 * provider. This is called by the ranker; it must not do IO beyond the two
 * lookups below, or ranking becomes N queries slow.
 */
export function checkEntitlement(
  providerId: number,
  providerEnabled: boolean,
  modelId: string,
): EntitlementCheck {
  if (!providerEnabled) {
    return {
      allowed: false,
      reason: "provider-disabled",
      explanation: "provider is disabled in settings",
    };
  }
  const sub = getSubscription(providerId);
  if (!sub) {
    return {
      allowed: false,
      reason: "no-subscription",
      explanation:
        "no subscription is configured for this provider; add one under settings",
    };
  }
  if (sub.denyModels.includes(modelId)) {
    return {
      allowed: false,
      reason: "in-deny-list",
      explanation: "model is denied by the subscription",
    };
  }
  if (sub.allowModels.length > 0 && !sub.allowModels.includes(modelId)) {
    return {
      allowed: false,
      reason: "not-in-allow-list",
      explanation: "model is not in the subscription's allow-list",
    };
  }
  return { allowed: true };
}

/* ------------------------------------------- implicit provider budget (#170) */

export interface ProviderBudgetCheck {
  /** Null when the provider has no implicit cap to enforce. */
  monthlyBudget: number;
  spentCents: number;
  percentUsed: number;
  status: "ok" | "warning" | "exceeded";
}

/**
 * The monthly spend cap on a subscription, evaluated against THIS provider's
 * usage_events only (#170).
 *
 * Deliberately an implicit budget, not a row in the budgets table: a
 * subscription's monthlyBudget is what the user signed up for -- capping spend
 * at the provider is a consequence of that, and it should follow the
 * subscription automatically rather than requiring a second definition that
 * can drift out of sync.
 *
 * Exposed through the same evaluation shape as a budgets-table entry
 * (spend, percent, status) so #163's gate can consume it without a
 * special case: the implicit budget id is sub-<providerId>, which cannot
 * collide with a user-defined budget.
 */
export function evaluateBudgetForProvider(
  providerId: number,
  now: Date = new Date(),
): ProviderBudgetCheck | null {
  const sub = getSubscription(providerId);
  if (!sub || sub.monthlyBudget <= 0) return null;

  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const startIso = new Date(start).toISOString().slice(0, 19).replace("T", " ");
  const endIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  ).toISOString().slice(0, 19).replace("T", " ");

  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) AS usd
       FROM usage_events
       WHERE provider_id = ? AND ts >= ? AND ts < ?`,
    )
    .get(providerId, startIso, endIso) as { usd: number };

  const spentCents = Math.round((row.usd ?? 0) * 100);
  const limitCents = Math.round(sub.monthlyBudget * 100);
  const percentUsed = limitCents > 0 ? (spentCents / limitCents) * 100 : 0;
  const status = percentUsed >= 100 ? "exceeded" : percentUsed >= 80 ? "warning" : "ok";

  return { monthlyBudget: limitCents, spentCents, percentUsed, status };
}

/**
 * The implicit budget as a BudgetEvaluation, for the call gate (#170). Built
 * here rather than by evaluateBudget because the periods differ (calendar
 * month, UTC, no weekStartsOn) and there is no stored Budget row to evaluate.
 * 0-limit subscriptions return null upstream: no cap means nothing to enforce.
 */
export function implicitBudgetEvaluation(
  providerId: number,
  now: Date = new Date(),
): BudgetEvaluation | null {
  const check = evaluateBudgetForProvider(providerId, now);
  if (!check) return null;

  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const iso = (t: number) => new Date(t).toISOString().slice(0, 19).replace("T", " ");

  return {
    budgetId: `sub-${providerId}`,
    period: "monthly",
    window: { start: iso(start), end: iso(end), key: `${now.getUTCFullYear()}-${now.getUTCMonth()}` },
    limitCents: check.monthlyBudget,
    spentCents: check.spentCents,
    remainingCents: Math.max(0, check.monthlyBudget - check.spentCents),
    percentUsed: check.percentUsed,
    projectedCents: check.spentCents,
    elapsedFraction:
      (now.getTime() - start) / Math.max(1, end - start),
    status: check.status,
  };
}