import fs from "node:fs";

import { readHermesConfig, writeHermesConfig } from "./config-io";
import { emptyHermesConfig } from "./config-schema";
import { PROFILES_DIR, defaultProfilePaths, namedProfilePaths } from "./paths";

export interface HermesProfileSummary {
  id: string;
  label: string;
  isDefault: boolean;
  hasConfig: boolean;
  providerCount: number;
  defaultModel: string;
  defaultProvider: string;
  tierRouterEnabled: boolean;
  tierCount: number;
  // Set when a config.yaml exists but could not be parsed. The profile keeps its place in
  // the list with zeroed counts instead of failing the whole endpoint.
  configError?: string;
}

const CONFIG_ERROR_MAX = 80;

// One short line, never the config text itself. YAML parse errors embed the offending
// source line (right next to api_key values) after a blank line in err.message, and zod
// dumps issue JSON; only the diagnostic may surface. Field names and schema literals are
// fine, config values and source lines are not (issue.message/path carry neither).
function sanitizeConfigError(err: unknown): string {
  const issues = (err as { issues?: Array<{ path?: PropertyKey[]; message?: string }> })
    ?.issues;
  let msg: string;
  if (Array.isArray(issues) && issues.length > 0) {
    const first = issues[0];
    const where = (first.path ?? []).map(String).join(".") || "config";
    msg = `${where}: ${first.message ?? "invalid value"}`;
  } else {
    msg = err instanceof Error ? err.message : String(err);
  }
  return msg.split("\n")[0].slice(0, CONFIG_ERROR_MAX);
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
  try {
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
  } catch (err) {
    // Parse failure of one profile must not take down the profiles list (11 real profiles
    // used a tier mode the app did not know, returning 500 for the entire panel).
    return {
      id,
      label,
      isDefault,
      hasConfig: true,
      providerCount: 0,
      defaultModel: "",
      defaultProvider: "",
      tierRouterEnabled: false,
      tierCount: 0,
      configError: sanitizeConfigError(err),
    };
  }
}

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

export function deleteProfile(id: string): void {
  if (id === "default") throw new Error("the default profile cannot be deleted");
  const { root } = namedProfilePaths(id);
  if (!fs.existsSync(root)) throw new Error(`profile "${id}" does not exist`);

  const trashName = `.deleted-${id}-${Date.now()}`;
  const trashPath = `${PROFILES_DIR}/${trashName}`;
  fs.renameSync(root, trashPath);
}
