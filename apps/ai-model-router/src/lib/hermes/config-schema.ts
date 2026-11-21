import { z } from "zod";

export const modelRefSchema = z.object({
  provider: z.string(),
  model: z.string(),
  base_url: z.string().optional(),
  timeout: z.number().optional(),
  api_key: z.string().optional(),
  api_mode: z.string().optional(),
  // Hermes pool entries may carry a weight for weighted_round_robin tiers. agent/
  // tier_router.py _clean_pool keeps only provider, model, base_url, weight and coerces
  // exactly like max(1, int(e["weight"])) with fallback 1 on TypeError/ValueError, so an
  // integer string passes ('3' -> 3), a value Python int() rejects becomes 1, and nothing
  // here may fail the profile (verified against tier_router.py 193-197).
  weight: z
    .preprocess((v) => {
      if (v === undefined || v === null) return undefined;
      // Python int() accepts only sign + digits in strings ('3.9' and 'abc' raise -> 1).
      if (typeof v === "string" && !/^[+-]?\d+$/.test(v.trim())) return 1;
      const n = Number(v);
      if (!Number.isFinite(n)) return 1;
      return Math.max(1, Math.trunc(n));
    }, z.number().optional()),
});
export type ModelRef = z.infer<typeof modelRefSchema>;

const providerEntrySchema = z
  .object({
    api: z.string().optional(),
    request_timeout_seconds: z.number().optional(),
    default_model: z.string().optional(),
    name: z.string().optional(),
    api_key: z.string().optional(),
  })
  .passthrough();
export type ProviderEntry = z.infer<typeof providerEntrySchema>;

const modelSectionSchema = z
  .object({
    default: z.string().optional(),
    provider: z.string().optional(),
    base_url: z.string().optional(),
    reasoning_effort: z.string().optional(),
    api_mode: z.string().optional(),
    api_key: z.string().optional(),
  })
  .passthrough();

const tierEntrySchema = z
  .object({
    // Mirrors Hermes agent/tier_router.py RouterConfig.from_config: priority and
    // round_robin are run as-is, weighted_round_robin is expanded by Hermes into a smooth
    // weighted round-robin sequence at load time.
    mode: z.enum(["priority", "round_robin", "weighted_round_robin"]).optional(),
    escalate_to: z.string().nullable().optional(),
    pool: z.array(modelRefSchema).default([]),
    fallback: z.array(modelRefSchema).default([]),
  })
  .passthrough();
export type TierEntry = z.infer<typeof tierEntrySchema>;

const tierRouterSchema = z
  .object({
    enabled: z.boolean().default(false),
    default_tier: z.string().default("normal"),
    cooldown_s: z.number().default(120),
    restore_primary: z.boolean().optional(),
    classifier: z
      .object({
        pool: z.array(modelRefSchema).default([]),
        enabled: z.boolean().optional(),
        timeout_s: z.number().optional(),
        history_turns: z.number().optional(),
        systemone: z
          .object({
            enabled: z.boolean().optional(),
            endpoints: z.array(z.string()).optional(),
            timeout_s: z.number().optional(),
            attempt_timeout_s: z.number().optional(),
            min_confidence: z.number().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .default({ pool: [] }),
    tiers: z.record(z.string(), tierEntrySchema).default({}),
    routes: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  })
  .passthrough();
export type TierRouterConfig = z.infer<typeof tierRouterSchema>;

export const hermesConfigSchema = z
  .object({
    model: modelSectionSchema.default({}),
    providers: z.record(z.string(), providerEntrySchema).default({}),
    fallback_providers: z.array(modelRefSchema).default([]),
    model_aliases: z.record(z.string(), z.unknown()).optional(),
    tier_router: tierRouterSchema.optional(),
  })
  .passthrough();
export type HermesConfig = z.infer<typeof hermesConfigSchema>;

export function parseHermesConfig(raw: unknown): HermesConfig {
  return hermesConfigSchema.parse(raw ?? {});
}

export const KNOWN_TIER_NAMES = [
  "trivial",
  "normal",
  "complex",
  "plan",
  "test",
  "research",
  "writing",
  "automation",
  "monitoring",
] as const;

export function emptyTier(): TierEntry {
  return { mode: "round_robin", escalate_to: null, pool: [], fallback: [] };
}

export function emptyTierRouter(): TierRouterConfig {
  return {
    enabled: false,
    default_tier: "normal",
    cooldown_s: 120,
    classifier: { pool: [] },
    tiers: {},
  };
}

export function emptyHermesConfig(): HermesConfig {
  return parseHermesConfig({});
}
