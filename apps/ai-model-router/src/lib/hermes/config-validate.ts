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

export interface ValidationOutcome {
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface PoolTarget {
  tier: string;
  list: PoolList;
  entries: readonly ModelRef[];
  base: readonly ModelRef[];
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

type ModelProblem = { field: "model"; level: "error" | "warning"; message: string };

function providerOwnsModel(m: Model, provider: string): boolean {
  const needle = provider.trim().toLowerCase();
  return (
    m.providerSlug.trim().toLowerCase() === needle ||
    m.providerName.trim().toLowerCase() === needle
  );
}

function modelProblem(entry: ModelRef, catalog: ModelCatalog): ModelProblem | null {
  const needle = entry.model.trim().toLowerCase();
  if (!needle) return { field: "model", level: "error", message: "model is required" };
  const matches = catalog.models.filter(
    (m) =>
      m.modelId.trim().toLowerCase() === needle ||
      m.label.trim().toLowerCase() === needle,
  );
  if (matches.length === 0) {
    return {
      field: "model",
      level: "warning",
      message: `model "${entry.model}" is not in the router model catalog`,
    };
  }
  // Prefer matches whose provider owns the model id, so the verdict and the
  // cited reason refer to the model the row actually asks for.
  const owned = matches.filter((m) => providerOwnsModel(m, entry.provider));
  const candidates = owned.length > 0 ? owned : matches;
  const usable = candidates.filter(
    (m) => explainExclusions([m], CHAT_POOL_CRITERIA).excluded.length === 0,
  );
  if (usable.length === 0) {
    const report = explainExclusions(candidates, CHAT_POOL_CRITERIA);
    return {
      field: "model",
      level: "error",
      message: `model "${entry.model}" cannot join a chat pool: ${report.excluded[0].primary.message}`,
    };
  }
  return null;
}

function rowProblems(
  tier: string,
  list: PoolList,
  index: number,
  entry: ModelRef,
  config: HermesConfig,
  catalog: ModelCatalog,
): ValidationOutcome {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const providers = config.providers ?? {};
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
    (problem.level === "error" ? errors : warnings).push({
      tier,
      index,
      list,
      field: problem.field,
      message: problem.message,
    });
  }
  return { errors, warnings };
}

export function validatePoolEntries(
  tier: string,
  list: PoolList,
  entries: readonly ModelRef[],
  config: HermesConfig,
  catalog: ModelCatalog,
): ValidationOutcome {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  entries.forEach((entry, index) => {
    const outcome = rowProblems(tier, list, index, entry, config, catalog);
    errors.push(...outcome.errors);
    warnings.push(...outcome.warnings);
  });
  return { errors, warnings };
}

function sameRow(a: ModelRef, b: ModelRef): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) {
      return false;
    }
  }
  return true;
}

function targetsFor(before: HermesConfig, after: HermesConfig, target: ValidationTarget): PoolTarget[] {
  if (!target) return [];
  const tr = after.tier_router;
  const beforeTr = before.tier_router;
  if (target.kind === "classifier") {
    return [
      {
        tier: "classifier",
        list: "pool",
        entries: tr?.classifier.pool ?? [],
        base: beforeTr?.classifier.pool ?? [],
      },
    ];
  }
  const tier = tr?.tiers?.[target.name];
  if (!tier) return [];
  return (["pool", "fallback"] as const).map((list) => ({
    tier: target.name,
    list,
    entries: tier[list] ?? [],
    base: beforeTr?.tiers?.[target.name]?.[list] ?? [],
  }));
}

export function validateWrittenEntries(
  before: HermesConfig,
  after: HermesConfig,
  target: ValidationTarget,
  catalog: ModelCatalog,
): ValidationOutcome {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  for (const { tier, list, entries, base } of targetsFor(before, after, target)) {
    entries.forEach((entry, index) => {
      // Only rows that are new or changed compared with the same tier and list
      // on disk are validated. Unchanged rows are never errors.
      if (base.some((row) => sameRow(row, entry))) return;
      const outcome = rowProblems(tier, list, index, entry, after, catalog);
      errors.push(...outcome.errors);
      warnings.push(...outcome.warnings);
    });
  }
  return { errors, warnings };
}
