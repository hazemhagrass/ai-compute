import { z } from "zod";

import { getSetting, setSetting } from "./db";

const POLICY_KEY = "routing_policy_v1";

export const routingPolicySchema = z.object({
  preferLocal: z.boolean().default(true),
  fallbackToLocal: z.boolean().default(true),
  maxOutputCostPer1M: z.number().min(0).default(0),
  minContext: z.number().int().min(0).default(0),
  enforceEntitlements: z.boolean().default(true),
  overrideWeights: z.record(z.string(), z.number()).default({}),
  strictEmpty: z.boolean().default(false),
});

export type RoutingPolicy = z.infer<typeof routingPolicySchema>;

export function defaultPolicy(): RoutingPolicy {
  return routingPolicySchema.parse({});
}

export function getRoutingPolicy(): RoutingPolicy {
  const raw = getSetting(POLICY_KEY, "");
  if (!raw) return defaultPolicy();
  try {
    return routingPolicySchema.parse(JSON.parse(raw));
  } catch {
    return defaultPolicy();
  }
}

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
