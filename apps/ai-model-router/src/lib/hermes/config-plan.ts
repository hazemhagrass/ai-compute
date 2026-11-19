import crypto from "node:crypto";
import fs from "node:fs";

import YAML from "yaml";

import { unifiedDiff } from "./config-diff";
import { ConfigChangeError } from "./config-errors";
import type { HermesConfig } from "./config-schema";
import { parseHermesConfigText, writeHermesConfig } from "./config-io";
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
  baseHash: string;
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  next: HermesConfig;
}

function readConfigText(profileId: string): string {
  const { configPath } = profilePaths(profileId);
  return fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
}

function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function planConfigChange(
  profileId: string,
  target: ValidationTarget,
  mutate: (config: HermesConfig) => HermesConfig,
): ConfigChangePlan {
  const beforeText = readConfigText(profileId);
  const before = parseHermesConfigText(beforeText);
  const next = mutate(structuredClone(before));
  const { errors, warnings } = validateWrittenEntries(before, next, target, loadModelCatalog());
  const yaml = YAML.stringify(next, { lineWidth: 0 });
  return {
    yaml,
    diff: unifiedDiff(beforeText, yaml),
    baseHash: sha256Hex(beforeText),
    valid: errors.length === 0,
    errors,
    warnings,
    next,
  };
}

export function commitConfigChange(profileId: string, plan: ConfigChangePlan): void {
  if (!plan.valid) throw new Error("refusing to write a config that failed validation");
  if (sha256Hex(readConfigText(profileId)) !== plan.baseHash) {
    throw new ConfigChangeError(
      409,
      "config.yaml changed while this change was being planned; re-run the preview",
    );
  }
  writeHermesConfig(profileId, plan.next);
}

export function expectedBaseHash(request: Request): string | null {
  const raw = request.headers.get("if-match");
  if (!raw) return null;
  return raw.trim().replace(/^W\//i, "").replace(/^"|"$/g, "");
}

export function planPayload(
  plan: ConfigChangePlan,
  dryRun: boolean,
): {
  dryRun: boolean;
  yaml: string;
  diff: string;
  baseHash: string;
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  return {
    dryRun,
    yaml: plan.yaml,
    diff: plan.diff,
    baseHash: plan.baseHash,
    valid: plan.valid,
    errors: plan.errors,
    warnings: plan.warnings,
  };
}
