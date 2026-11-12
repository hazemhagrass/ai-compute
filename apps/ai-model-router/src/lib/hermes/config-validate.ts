import { explainExclusions, type ExclusionCriteria } from "../exclusions";
import { listModels } from "../repo";
import type { Model, Task } from "../types";
import type { HermesConfig, ModelRef } from "./config-schema";

export type PoolList = "pool" | "fallback";

export interface ValidationError {
  tier: string;
  index: number;
  field: "provider" | "model";
  message: string;
  list?: PoolList;
}

export interface PoolTarget {
  tier: string;
  list: PoolList;
  entries: readonly ModelRef[];
}

export type ValidationTarget =
  | { kind: "tier"; name: string }
  | { kind: "classifier" }
  | null;

export interface ModelCatalog {
  models: readonly Model[];
}

export function loadModelCatalog(): ModelCatalog {
  return { models: listModels() };
}

const CHAT_POOL_TASK: Task = {
  id: 0,
  slug: "tier-pool",
  label: "Tier pool",
  description: "A model joining a chat routing pool",
  weights: {},
  requires: {},
  pinnedModelId: null,
  builtin: false,
  createdAt: "",
  updatedAt: "",
};

const CHAT_POOL_CRITERIA: ExclusionCriteria = { task: CHAT_POOL_TASK };

function modelProblem(entry: ModelRef, catalog: ModelCatalog): string | null {
  const needle = entry.model.trim().toLowerCase();
  if (!needle) return "model is required";
  const matches = catalog.models.filter(
    (m) =>
      m.modelId.trim().toLowerCase() === needle ||
      m.label.trim().toLowerCase() === needle,
  );
  if (matches.length === 0) {
    return `model "${entry.model}" is not in the router model catalog`;
  }
  const usable = matches.filter(
    (m) => explainExclusions([m], CHAT_POOL_CRITERIA).excluded.length === 0,
  );
  if (usable.length === 0) {
    const report = explainExclusions(matches, CHAT_POOL_CRITERIA);
    return `model "${entry.model}" cannot join a chat pool: ${report.excluded[0].primary.message}`;
  }
  return null;
}

export function validatePoolEntries(
  tier: string,
  list: PoolList,
  entries: readonly ModelRef[],
  config: HermesConfig,
  catalog: ModelCatalog,
): ValidationError[] {
  const providers = config.providers ?? {};
  const errors: ValidationError[] = [];
  entries.forEach((entry, index) => {
    if (!(entry.provider in providers)) {
      errors.push({
        tier,
        index,
        list,
        field: "provider",
        message: `provider "${entry.provider}" is not configured for this profile`,
      });
    }
    const problem = modelProblem(entry, catalog);
    if (problem) {
      errors.push({ tier, index, list, field: "model", message: problem });
    }
  });
  return errors;
}

function targetsFor(config: HermesConfig, target: ValidationTarget): PoolTarget[] {
  if (!target) return [];
  const tr = config.tier_router;
  if (target.kind === "classifier") {
    return [{ tier: "classifier", list: "pool", entries: tr?.classifier.pool ?? [] }];
  }
  const tier = tr?.tiers?.[target.name];
  if (!tier) return [];
  return [
    { tier: target.name, list: "pool", entries: tier.pool ?? [] },
    { tier: target.name, list: "fallback", entries: tier.fallback ?? [] },
  ];
}

export function validateWrittenEntries(
  config: HermesConfig,
  target: ValidationTarget,
  catalog: ModelCatalog,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const { tier, list, entries } of targetsFor(config, target)) {
    errors.push(...validatePoolEntries(tier, list, entries, config, catalog));
  }
  return errors;
}
