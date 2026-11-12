import fs from "node:fs";

import YAML from "yaml";

import { unifiedDiff } from "./config-diff";
import type { HermesConfig } from "./config-schema";
import { readHermesConfig, writeHermesConfig } from "./config-io";
import {
  loadModelCatalog,
  validateWrittenEntries,
  type ValidationError,
  type ValidationTarget,
} from "./config-validate";
import { profilePaths } from "./paths";

export interface ConfigChangePlan {
  yaml: string;
  diff: string;
  valid: boolean;
  errors: ValidationError[];
  next: HermesConfig;
}

export function readConfigText(profileId: string): string {
  const { configPath } = profilePaths(profileId);
  return fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
}

export function planConfigChange(
  profileId: string,
  target: ValidationTarget,
  mutate: (config: HermesConfig) => HermesConfig,
): ConfigChangePlan {
  const beforeText = readConfigText(profileId);
  const next = mutate(readHermesConfig(profileId));
  const errors = validateWrittenEntries(next, target, loadModelCatalog());
  const yaml = YAML.stringify(next, { lineWidth: 0 });
  return {
    yaml,
    diff: unifiedDiff(beforeText, yaml),
    valid: errors.length === 0,
    errors,
    next,
  };
}

export function commitConfigChange(profileId: string, plan: ConfigChangePlan): void {
  if (!plan.valid) throw new Error("refusing to write a config that failed validation");
  writeHermesConfig(profileId, plan.next);
}

export function planPayload(
  plan: ConfigChangePlan,
  dryRun: boolean,
): {
  dryRun: boolean;
  yaml: string;
  diff: string;
  valid: boolean;
  errors: ValidationError[];
} {
  return {
    dryRun,
    yaml: plan.yaml,
    diff: plan.diff,
    valid: plan.valid,
    errors: plan.errors,
  };
}
