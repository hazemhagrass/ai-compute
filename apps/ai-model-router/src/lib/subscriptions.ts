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
