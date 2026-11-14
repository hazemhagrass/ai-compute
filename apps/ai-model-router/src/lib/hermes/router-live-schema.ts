import { z } from "zod";

// Live tier-router view shape. Two data sources, in priority order:
// 1. <profileRoot>/state/tier-router.json, written by Hermes itself (a Phase B Hermes-core
//    patch): exact cooldown expiries and the full decision stamp list.
// 2. The profile's agent.log{,.1,.2,.3} agent.tier_router lines: decisions, restore events,
//    and APPROXIMATE cooldown windows derived from logged classifier failures.
// Until the Hermes writer exists (Phase B), this app works purely from logs and every
// cooldown entry it produces carries approx: true.

// One cap for the decision list, shared by the log path, the state-file path, and the
// response schema so they cannot drift apart.
export const DECISIONS_KEEP = 10;

export const decisionSchema = z.object({
  at: z.string(),
  tier_requested: z.string(),
  tier_used: z.string(),
  source: z.string(),
  model: z.string().optional(),
  provider: z.string().optional(),
  switched: z.boolean().optional(),
});
export type RouterDecision = z.infer<typeof decisionSchema>;

export const restoreSchema = z.object({
  enabled: z.boolean().default(false),
  last_event: z.enum(["restored", "deferred"]).optional(),
  last_model: z.string().optional(),
  last_provider: z.string().optional(),
  last_at: z.string().optional(),
  pending_capture: z.boolean().optional(),
});
export type RouterRestore = z.infer<typeof restoreSchema>;

export const cooldownEntrySchema = z.object({
  provider: z.string(),
  model: z.string(),
  base_url: z.string().optional(),
  scope: z.string(),
  expires_at: z.string(),
  approx: z.boolean().default(false),
});
export type CooldownEntry = z.infer<typeof cooldownEntrySchema>;

// Shape of the Phase B state file <profileRoot>/state/tier-router.json. The Hermes-side
// writer must emit these field names; both sides should treat any drift as a fallback to
// logs (never a hard failure of the endpoint).
export const tierRouterStateSchema = z
  .object({
    schema: z.number(),
    generated_at: z.string(),
    pid: z.number().optional(),
    balancer: z
      .object({
        coolings: z
          .array(cooldownEntrySchema.omit({ approx: true }))
          .default([]),
      })
      .passthrough()
      .default({ coolings: [] }),
    last_decision: decisionSchema.optional(),
    decisions: z.array(decisionSchema).default([]),
    restore: restoreSchema.partial().optional(),
  })
  .passthrough();
export type TierRouterStateFile = z.infer<typeof tierRouterStateSchema>;

// Response body of GET /api/hermes/profiles/[id]/router-live (after the "routerLive" key).
export const routerLiveSchema = z.object({
  profile: z.string(),
  source: z.enum(["state", "logs", "none"]),
  generated_at: z.string(),
  state_stale: z.boolean().optional(),
  cooldowns: z.array(cooldownEntrySchema).default([]),
  decisions: z.array(decisionSchema).max(DECISIONS_KEEP).default([]),
  restore: restoreSchema.default({ enabled: false }),
  warnings: z.array(z.string()).default([]),
});
export type RouterLive = z.infer<typeof routerLiveSchema>;
