import type { ModelRef } from "./config-schema";
import { updateHermesConfig, readHermesConfig } from "./config-io";

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
