/**
 * Structured explanations for candidates the ranker threw away.
 *
 * `rankModels` drops ineligible models with a bare `continue`, so the UI can
 * only ever show what survived. This module replays the same hard filters over
 * the same inputs and reports, per model, why it did not make the list. It is
 * deliberately a pure function over data the caller already has: no database,
 * no repo lookups, so it can be unit tested and also run client-side.
 */

import type { RankOptions } from "./engine";
import type { Model, Task } from "./types";

/** Stable, machine-readable exclusion codes. Safe to switch on in the UI. */
export type ExclusionCode =
  | "disabled"
  | "provider_disabled"
  | "over_budget"
  | "context_too_small"
  | "missing_capability"
  | "embedding_only";

export interface ExclusionReason {
  code: ExclusionCode;
  /**
   * Sub-key that makes a code renderable as its own bucket, e.g. the specific
   * capability for `missing_capability`. Two models missing different features
   * should not be grouped under one vague "missing capability" heading.
   */
  subject?: string;
  /** Human sentence that always names the real numbers involved. */
  message: string;
  /** The same facts as raw values, for callers that format their own copy. */
  detail: Record<string, string | number | boolean>;
}

export interface ExcludedCandidate {
  modelId: number;
  label: string;
  providerSlug: string;
  /**
   * Every reason the model failed, in filter order. We report all of them
   * rather than the first because the actionable question is "what would I
   * have to change to get this model back", and fixing only the first reason
   * leaves the user re-running the router to discover the next one.
   */
  reasons: ExclusionReason[];
  /**
   * The first reason in filter order. Grouping keys off this one so the group
   * counts sum exactly to the number of excluded models, which is what makes
   * the headline sentence honest.
   */
  primary: ExclusionReason;
}

export interface ExclusionGroup {
  code: ExclusionCode;
  subject?: string;
  /** Short human label for the bucket, e.g. "over budget", "missing vision". */
  label: string;
  count: number;
  modelIds: number[];
}

export interface ExclusionReport {
  excluded: ExcludedCandidate[];
  /** Grouped by primary reason, largest bucket first. */
  groups: ExclusionGroup[];
  totalExcluded: number;
  /** e.g. "excluded 12 models: 8 over budget, 4 missing vision" */
  summary: string;
}

export interface ExclusionCriteria extends RankOptions {
  task: Task;
}

/** 128000 -> "128k". Small windows stay exact so "512" never reads as "1k". */
function formatTokens(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

function formatUsd(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** Feature requirements, in the same order `meetsRequirements` checks them. */
const CAPABILITY_CHECKS: {
  key: keyof Task["requires"];
  feature: keyof Model["features"];
  noun: string;
}[] = [
  { key: "tools", feature: "tools", noun: "tool calling" },
  { key: "vision", feature: "vision", noun: "vision" },
  { key: "json", feature: "json", noun: "JSON mode" },
  { key: "reasoning", feature: "reasoning", noun: "reasoning mode" },
  { key: "audio", feature: "audio", noun: "audio" },
  { key: "embedding", feature: "embedding", noun: "embeddings" },
];

function groupLabel(reason: ExclusionReason): string {
  switch (reason.code) {
    case "disabled":
      return "disabled";
    case "provider_disabled":
      return "provider not selected";
    case "over_budget":
      return "over budget";
    case "context_too_small":
      return "context too small";
    case "embedding_only":
      return "embedding-only";
    case "missing_capability":
      return `missing ${reason.subject ?? "capability"}`;
  }
}

/**
 * Collect every hard-filter failure for one model. Empty result means the model
 * is eligible and therefore appears in the ranking instead of this report.
 */
function reasonsFor(model: Model, criteria: ExclusionCriteria): ExclusionReason[] {
  const { task } = criteria;
  const requires = task.requires ?? {};
  const reasons: ExclusionReason[] = [];

  if (!model.enabled) {
    reasons.push({
      code: "disabled",
      message: `${model.label} is disabled in the catalog`,
      detail: { enabled: false },
    });
  }

  const providerIds = criteria.providerIds;
  if (providerIds?.length && !providerIds.includes(model.providerId)) {
    reasons.push({
      code: "provider_disabled",
      message:
        `${model.label} belongs to provider ${model.providerName} (id ${model.providerId}), ` +
        `which is not among the ${providerIds.length} selected provider(s)`,
      detail: { providerId: model.providerId, selectedProviders: providerIds.length },
    });
  }

  if (criteria.maxOutputCost !== undefined && model.outputCost > criteria.maxOutputCost) {
    reasons.push({
      code: "over_budget",
      message:
        `costs ${formatUsd(model.outputCost)} per 1M output tokens, ` +
        `budget is ${formatUsd(criteria.maxOutputCost)}`,
      detail: { outputCost: model.outputCost, maxOutputCost: criteria.maxOutputCost },
    });
  }

  // The option ceiling and the task requirement are the same constraint from
  // two sources, so report the binding one once instead of twice.
  const minContext = Math.max(criteria.minContext ?? 0, requires.minContext ?? 0);
  // A contextWindow of 0 means "not recorded"; the ranker keeps those rather
  // than guessing, so they are not excluded here either.
  if (minContext > 0 && model.contextWindow > 0 && model.contextWindow < minContext) {
    reasons.push({
      code: "context_too_small",
      message:
        `needs ${formatTokens(minContext)} context, ` +
        `model has ${formatTokens(model.contextWindow)}`,
      detail: { required: minContext, actual: model.contextWindow },
    });
  }

  for (const check of CAPABILITY_CHECKS) {
    if (requires[check.key] && !model.features[check.feature]) {
      reasons.push({
        code: "missing_capability",
        subject: check.noun,
        message: `task requires ${check.noun}, ${model.label} does not support it`,
        detail: { capability: check.feature },
      });
    }
  }

  if (!requires.embedding && model.features.embedding) {
    reasons.push({
      code: "embedding_only",
      message: `${model.label} is an embedding-only model and cannot answer this task`,
      detail: { embedding: true },
    });
  }

  return reasons;
}

export function explainExclusions(
  candidates: Model[],
  criteria: ExclusionCriteria,
): ExclusionReport {
  const excluded: ExcludedCandidate[] = [];

  for (const model of candidates) {
    const reasons = reasonsFor(model, criteria);
    if (!reasons.length) continue;
    excluded.push({
      modelId: model.id,
      label: model.label,
      providerSlug: model.providerSlug,
      reasons,
      primary: reasons[0],
    });
  }

  const byKey = new Map<string, ExclusionGroup>();
  for (const candidate of excluded) {
    const { primary } = candidate;
    const key = `${primary.code}:${primary.subject ?? ""}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        code: primary.code,
        subject: primary.subject,
        label: groupLabel(primary),
        count: 0,
        modelIds: [],
      };
      byKey.set(key, group);
    }
    group.count++;
    group.modelIds.push(candidate.modelId);
  }

  // Largest bucket first is what a reader wants: the dominant reason is the one
  // worth acting on. Ties fall back to label so the output stays deterministic.
  const groups = [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );

  const total = excluded.length;
  const summary = total
    ? `excluded ${total} model${total === 1 ? "" : "s"}: ` +
      groups.map((g) => `${g.count} ${g.label}`).join(", ")
    : "no models excluded";

  return { excluded, groups, totalExcluded: total, summary };
}
