import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { emptyTierRouter, type HermesConfig, parseHermesConfig } from "./config-schema";
import { profilePaths } from "./paths";

/**
 * Read a profile's config.yaml. Missing file (a profile that only has a
 * state.db so far) reads as an empty config rather than throwing — the UI
 * can still show empty provider/tier lists and let the user add the first
 * one.
 */
export function readHermesConfig(profileId: string): HermesConfig {
  const { configPath } = profilePaths(profileId);
  if (!fs.existsSync(configPath)) return parseHermesConfig({});
  const raw = YAML.parse(fs.readFileSync(configPath, "utf8"));
  return parseHermesConfig(raw);
}

/**
 * Write a profile's config.yaml.
 *
 * Hermes itself (CLI, gateway, cron) can rewrite this file between our read
 * and write — same risk noted for the ai-computer repo's background rewriter
 * (see project memory). Mitigate two ways:
 *  1. A one-generation `.bak` is kept before every write, so a bad write is
 *     one `mv` away from undone.
 *  2. The write itself is atomic (write to a temp file in the same dir, then
 *     rename) so a crash mid-write never leaves a half-written YAML file
 *     that fails every subsequent parse.
 *
 * This does NOT fully solve concurrent-writer races (a true fix needs a file
 * lock Hermes itself respects, which is out of scope for a dashboard) — but
 * it removes the two failure modes a plugin can cause on its own.
 */
export function writeHermesConfig(profileId: string, config: HermesConfig): void {
  const { configPath } = profilePaths(profileId);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, configPath + ".bak");
  }

  const yamlText = YAML.stringify(config, { lineWidth: 0 });
  const tmpPath = `${configPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, yamlText, "utf8");
  fs.renameSync(tmpPath, configPath);
}

/**
 * Read-modify-write in one call so every mutation goes through the same
 * backup + atomic-write path; `mutate` receives a config that always has
 * `tier_router` populated (defaulted) so callers don't need an `?? {}` at
 * every call site.
 */
export function updateHermesConfig(
  profileId: string,
  mutate: (config: HermesConfig) => HermesConfig | void,
): HermesConfig {
  const current = readHermesConfig(profileId);
  if (!current.tier_router) current.tier_router = emptyTierRouter();
  const mutated = mutate(current);
  const next = mutated ?? current;
  writeHermesConfig(profileId, next);
  return next;
}
