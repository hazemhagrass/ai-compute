import { z } from "zod";

/**
 * Typed slice of Hermes's `config.yaml` this dashboard reads/writes.
 *
 * Only the keys we actually touch are typed strictly; everything else in the
 * file is kept as `unknown` passthrough (`z.record` catch-all via
 * `.passthrough()`) so a round-trip through this schema never drops a
 * section we don't know about (mcp_servers, terminal, compression, ...).
 */

export const modelRefSchema = z.object({
  provider: z.string(),
  model: z.string(),
  base_url: z.string().optional(),
  timeout: z.number().optional(),
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
    mode: z.enum(["round_robin", "priority"]).optional(),
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
    classifier: z
      .object({
        pool: z.array(modelRefSchema).default([]),
        timeout_s: z.number().optional(),
        history_turns: z.number().optional(),
      })
      .passthrough()
      .default({ pool: [] }),
    tiers: z.record(z.string(), tierEntrySchema).default({}),
    routes: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  })
  .passthrough();
export type TierRouterConfig = z.infer<typeof tierRouterSchema>;

/**
 * The subset of config.yaml this app understands strictly; every other
 * top-level key round-trips untouched via the index signature.
 */
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

/** A brand-new profile's config.yaml — valid against the schema, empty of
 * providers/tiers, ready for the dashboard to populate. */
export function emptyHermesConfig(): HermesConfig {
  return parseHermesConfig({});
}
