/**
 * Typed routing policy (issue #155).
 *
 * The previous world stored everything in an untyped `settings` KV bag. Any
 * key, any shape, any type. That is a bug factory. This module owns a single
 * typed policy that describes what the router should do at ranking time, with
 * default values and a zod schema so every read is validated on the way out.
 */
import { z } from "zod";

import { getSetting, setSetting } from "./db";

const POLICY_KEY = "routing_policy_v1";

export const routingPolicySchema = z.object({
  /** Prefer local providers when their models satisfy the requirements. */
  preferLocal: z.boolean().default(true),
  /** Fall back to local models when all cloud providers are unreachable. */
  fallbackToLocal: z.boolean().default(true),
  /** Hard USD ceiling per 1M output tokens; 0 = no cap. */
  maxOutputCostPer1M: z.number().min(0).default(0),
  /** Minimum context window; 0 = no requirement. */
  minContext: z.number().int().min(0).default(0),
  /** Whether to honour subscription entitlement filtering at rank time. */
  enforceEntitlements: z.boolean().default(true),
  /** Weight overrides applied on top of the task's own weights. */
  overrideWeights: z.record(z.string(), z.number()).default({}),
  /** When true, an empty ranking result is treated as a hard failure. */
  strictEmpty: z.boolean().default(false),
});

export type RoutingPolicy = z.infer<typeof routingPolicySchema>;

export function defaultPolicy(): RoutingPolicy {
  return routingPolicySchema.parse({});
}

/**
 * Read the current policy. Invalid stored JSON returns the default: rejecting
 * a policy that once parsed but drifted would lock the user out of the UI.
 */
export function getRoutingPolicy(): RoutingPolicy {
  const raw = getSetting(POLICY_KEY, "");
  if (!raw) return defaultPolicy();
  try {
    return routingPolicySchema.parse(JSON.parse(raw));
  } catch {
    return defaultPolicy();
  }
}

/**
 * Merge and save. The merge lets the UI PATCH a single field without shipping
 * the whole policy, which is what a form does on every change.
 */
export function updateRoutingPolicy(
  patch: Partial<RoutingPolicy>,
): RoutingPolicy {
  const current = getRoutingPolicy();
  const next = routingPolicySchema.parse({ ...current, ...patch });
  setSetting(POLICY_KEY, JSON.stringify(next));
  return next;
}

export function resetRoutingPolicy(): RoutingPolicy {
  const p = defaultPolicy();
  setSetting(POLICY_KEY, JSON.stringify(p));
  return p;
}
