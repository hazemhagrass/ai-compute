import type { ModelRef } from "./config-schema";
import { updateHermesConfig, readHermesConfig } from "./config-io";

/**
 * Global fallback chain: `config.yaml`'s top-level `fallback_providers`.
 * Used when a provider call fails outside the tier router (or by a tier
 * with no fallback of its own) — distinct from a tier's own `fallback`
 * list. Whole-chain replace keeps ordering explicit and simple: the array
 * order IS the failover order.
 */
export function getFallbackChain(profileId: string): ModelRef[] {
  return readHermesConfig(profileId).fallback_providers ?? [];
}

export function setFallbackChain(profileId: string, chain: ModelRef[]): ModelRef[] {
  const next = updateHermesConfig(profileId, (cfg) => {
    cfg.fallback_providers = chain;
    return cfg;
  });
  return next.fallback_providers ?? [];
}
