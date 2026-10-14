import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { emptyTierRouter, type HermesConfig, parseHermesConfig } from "./config-schema";
import { profilePaths } from "./paths";

export function readHermesConfig(profileId: string): HermesConfig {
  const { configPath } = profilePaths(profileId);
  if (!fs.existsSync(configPath)) return parseHermesConfig({});
  const raw = YAML.parse(fs.readFileSync(configPath, "utf8"));
  return parseHermesConfig(raw);
}

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
