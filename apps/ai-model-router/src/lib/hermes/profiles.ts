import fs from "node:fs";

import { readHermesConfig, writeHermesConfig } from "./config-io";
import { emptyHermesConfig } from "./config-schema";
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

const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/i;

export function isValidProfileName(name: string): boolean {
  return PROFILE_NAME_RE.test(name);
}

/**
 * Create a new named profile: `profiles/<id>/` with a minimal valid
 * config.yaml and an empty .env, matching what `hermes profile create`
 * produces on the CLI closely enough that Hermes's own profile discovery
 * picks it up with no restart (it only requires the directory + a readable
 * config.yaml).
 */
export function createProfile(id: string): HermesProfileSummary {
  if (id === "default") throw new Error("the default profile always exists");
  if (!isValidProfileName(id)) throw new Error("profile name must look like an identifier");
  const { root, envPath } = namedProfilePaths(id);
  if (fs.existsSync(root)) throw new Error(`profile "${id}" already exists`);

  fs.mkdirSync(root, { recursive: true });
  writeHermesConfig(id, emptyHermesConfig());
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, "", { mode: 0o600 });
  }
  return getHermesProfile(id);
}

/**
 * Delete a named profile. Never `rm -rf`s: the directory is renamed to a
 * `.deleted-<timestamp>` sibling under profiles/, matching the existing
 * `.deleted*` convention `listHermesProfiles` already filters out — so the
 * data survives a mistaken delete and a manual restore is a plain `mv`.
 * Refuses outright for "default" (that IS the Hermes install; there's
 * nothing to move it to).
 */
export function deleteProfile(id: string): void {
  if (id === "default") throw new Error("the default profile cannot be deleted");
  const { root } = namedProfilePaths(id);
  if (!fs.existsSync(root)) throw new Error(`profile "${id}" does not exist`);

  const trashName = `.deleted-${id}-${Date.now()}`;
  const trashPath = `${PROFILES_DIR}/${trashName}`;
  fs.renameSync(root, trashPath);
}
