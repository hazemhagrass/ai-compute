import fs from "node:fs";

import { readHermesConfig } from "./config-io";
import { PROFILES_DIR, defaultProfilePaths, namedProfilePaths } from "./paths";

export interface HermesProfileSummary {
  id: string;
  /** Human label; "default" doesn't have one of its own in Hermes, so the dir name is shown. */
  label: string;
  isDefault: boolean;
  hasConfig: boolean;
  providerCount: number;
  defaultModel: string;
  defaultProvider: string;
  tierRouterEnabled: boolean;
  tierCount: number;
}

function summarize(id: string, label: string, isDefault: boolean): HermesProfileSummary {
  const { configPath } = isDefault ? defaultProfilePaths() : namedProfilePaths(id);
  const hasConfig = fs.existsSync(configPath);
  if (!hasConfig) {
    return {
      id,
      label,
      isDefault,
      hasConfig: false,
      providerCount: 0,
      defaultModel: "",
      defaultProvider: "",
      tierRouterEnabled: false,
      tierCount: 0,
    };
  }
  const cfg = readHermesConfig(id);
  return {
    id,
    label,
    isDefault,
    hasConfig: true,
    providerCount: Object.keys(cfg.providers ?? {}).length,
    defaultModel: cfg.model?.default ?? "",
    defaultProvider: cfg.model?.provider ?? "",
    tierRouterEnabled: cfg.tier_router?.enabled ?? false,
    tierCount: Object.keys(cfg.tier_router?.tiers ?? {}).length,
  };
}

/** Every profile this Hermes install knows about: the default (root) profile
 * plus every directory under profiles/. Order: default first, then
 * alphabetical. */
export function listHermesProfiles(): HermesProfileSummary[] {
  const named = fs.existsSync(PROFILES_DIR)
    ? fs
        .readdirSync(PROFILES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => d.name)
        .sort()
    : [];

  return [summarize("default", "default", true), ...named.map((n) => summarize(n, n, false))];
}

export function getHermesProfile(id: string): HermesProfileSummary {
  return summarize(id, id, id === "default");
}
