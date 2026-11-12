import fs from "node:fs";

import {
  parseHermesConfig,
  type HermesConfig,
  type ModelRef,
  type TierRouterConfig,
} from "./config-schema";
import {
  loadModelCatalog,
  validateWrittenEntries,
  type ValidationOutcome,
} from "./config-validate";
import { ConfigChangeError } from "./config-errors";
import { readHermesConfig } from "./config-io";
import { isValidProfileName } from "./profiles";
import { profilePaths } from "./paths";
import { getRouterPreset } from "./router-presets";

export type TierRouterSource = { from: string } | { preset: string };

// A router copy must never move secrets between profiles. The .env file and the
// providers block are out of scope by construction (only tier_router is read),
// and any api_key that snuck into a model ref inside the router is dropped
// rather than copied, so template seeding cannot leak credentials.
function stripSecretRefs(router: TierRouterConfig): TierRouterConfig {
  const clone = structuredClone(router);
  const scrub = (refs: ModelRef[] | undefined): void => {
    if (!refs) return;
    for (const ref of refs) delete ref.api_key;
  };
  scrub(clone.classifier?.pool);
  for (const tier of Object.values(clone.tiers ?? {})) {
    scrub(tier.pool);
    scrub(tier.fallback);
  }
  return clone;
}

// Resolves a copy source to the tier_router block to install. Throws
// ConfigChangeError(404) when the source profile or preset does not exist or
// has no tier_router to copy. Never reads .env, provider entries or keys.
export function resolveTierRouterSource(source: TierRouterSource): TierRouterConfig {
  if ("preset" in source) {
    const preset = getRouterPreset(source.preset);
    if (!preset) throw new ConfigChangeError(404, `preset "${source.preset}" does not exist`);
    return stripSecretRefs(preset.tierRouter);
  }

  const id = source.from.trim();
  if (!isValidProfileName(id)) {
    throw new ConfigChangeError(404, `profile "${source.from}" does not exist`);
  }
  const { root, configPath } = profilePaths(id);
  if (!fs.existsSync(root) || !fs.existsSync(configPath)) {
    throw new ConfigChangeError(404, `profile "${id}" does not exist`);
  }
  const tierRouter = readHermesConfig(id).tier_router;
  if (!tierRouter) {
    throw new ConfigChangeError(404, `profile "${id}" has no tier_router to copy`);
  }
  return stripSecretRefs(tierRouter);
}

// Replaces the whole tier_router block and touches nothing else in the config.
export function applyImportTierRouter(config: HermesConfig, tierRouter: TierRouterConfig): HermesConfig {
  config.tier_router = structuredClone(tierRouter);
  return config;
}

// Validation for seeding a brand new profile before its config file exists.
// The target starts with no providers, so provider gaps are expected warnings
// under the import policy, never errors.
export function validateImportedRouter(tierRouter: TierRouterConfig): ValidationOutcome {
  const before = parseHermesConfig({});
  const after = parseHermesConfig({ tier_router: tierRouter });
  return validateWrittenEntries(before, after, { kind: "import" }, loadModelCatalog());
}
