import type { Model, Recommendation, Scored, Task } from "./types";

/** Axes that live on the model root rather than inside `skills`. */
const ROOT_AXES: Record<string, (m: Model) => number> = {
  quality: (m) => m.quality,
  speed: (m) => m.speed,
  cheapness: (m) => m.cheapness,
  vision: (m) => m.skills.vision ?? (m.features.vision ? 70 : 0),
  longContext: (m) =>
    m.skills.longContext ?? Math.min(100, Math.log10(Math.max(1, m.contextWindow)) * 18),
};

function axisValue(model: Model, axis: string): number {
  const root = ROOT_AXES[axis];
  if (root) {
    const fromSkills = model.skills[axis];
    return typeof fromSkills === "number" ? fromSkills : root(model);
  }
  const v = model.skills[axis];
  if (typeof v === "number") return v;
  // Unknown axis: fall back to overall quality, slightly discounted, so a model
  // with no explicit score is never auto-disqualified.
  return model.quality * 0.7;
}

function meetsRequirements(model: Model, task: Task): { ok: boolean; why?: string } {
  const r = task.requires ?? {};
  if (r.tools && !model.features.tools) return { ok: false, why: "no tool calling" };
  if (r.vision && !model.features.vision) return { ok: false, why: "no vision" };
  if (r.json && !model.features.json) return { ok: false, why: "no JSON mode" };
  if (r.reasoning && !model.features.reasoning) return { ok: false, why: "no reasoning mode" };
  if (r.audio && !model.features.audio) return { ok: false, why: "no audio" };
  if (r.embedding && !model.features.embedding) return { ok: false, why: "not an embedding model" };
  if (!r.embedding && model.features.embedding) {
    return { ok: false, why: "embedding-only model" };
  }
  if (r.minContext && model.contextWindow > 0 && model.contextWindow < r.minContext) {
    return { ok: false, why: `context ${model.contextWindow} < ${r.minContext}` };
  }
  return { ok: true };
}

export interface RankOptions {
  /** Extra weights merged over the task's own, e.g. from UI sliders. */
  overrideWeights?: Record<string, number>;
  /** Restrict to these provider ids. */
  providerIds?: number[];
  /** Only local providers (offline / privacy mode). */
  localOnly?: boolean;
  /** Ignore the task's pinned model. */
  ignorePin?: boolean;
  /** Hard ceiling on output cost, USD per 1M tokens. */
  maxOutputCost?: number;
  /** Require at least this context window. */
  minContext?: number;
  limit?: number;
}

export function rankModels(
  task: Task,
  models: Model[],
  opts: RankOptions = {},
): Scored[] {
  const weights = { ...task.weights, ...(opts.overrideWeights ?? {}) };
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const totalWeight = entries.reduce((s, [, w]) => s + w, 0) || 1;

  const scored: Scored[] = [];

  for (const model of models) {
    if (!model.enabled) continue;
    if (opts.providerIds?.length && !opts.providerIds.includes(model.providerId)) continue;
    if (opts.maxOutputCost !== undefined && model.outputCost > opts.maxOutputCost) continue;
    if (opts.minContext && model.contextWindow > 0 && model.contextWindow < opts.minContext)
      continue;

    const req = meetsRequirements(model, task);
    if (!req.ok) continue;

    const breakdown = entries.map(([axis, weight]) => {
      const value = axisValue(model, axis);
      return { axis, weight, value, points: (value * weight) / totalWeight };
    });
    const score = breakdown.reduce((s, b) => s + b.points, 0);

    const reasons: string[] = [];
    const top = [...breakdown].sort((a, b) => b.points - a.points).slice(0, 3);
    for (const t of top) {
      reasons.push(`${t.axis} ${Math.round(t.value)}/100 (weight ${t.weight})`);
    }
    if (model.contextWindow)
      reasons.push(`${(model.contextWindow / 1000).toFixed(0)}k context`);
    if (model.outputCost === 0 && model.inputCost === 0) reasons.push("free / local");
    else reasons.push(`$${model.inputCost}/$${model.outputCost} per 1M`);

    scored.push({ model, score, breakdown, reasons });
  }

  scored.sort((a, b) => b.score - a.score || b.model.quality - a.model.quality);

  // Pinned model always surfaces first, flagged as a manual override.
  if (!opts.ignorePin && task.pinnedModelId) {
    const idx = scored.findIndex((s) => s.model.id === task.pinnedModelId);
    if (idx > 0) {
      const [pinned] = scored.splice(idx, 1);
      pinned.pinned = true;
      pinned.reasons.unshift("pinned manually for this task");
      scored.unshift(pinned);
    } else if (idx === 0) {
      scored[0].pinned = true;
    }
  }

  return typeof opts.limit === "number" ? scored.slice(0, opts.limit) : scored;
}

export function recommend(
  task: Task,
  models: Model[],
  opts: RankOptions = {},
): Recommendation {
  return {
    task,
    ranked: rankModels(task, models, { limit: 8, ...opts }),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Turn a free-text description ("I need to review a big Rust diff") into a
 * synthetic task by keyword matching against the axis vocabulary. Used when the
 * user types their own use case instead of picking a preset.
 */
const KEYWORDS: Record<string, string[]> = {
  planning: ["plan", "architect", "design", "roadmap", "break down", "spec", "strategy"],
  coding: ["code", "implement", "write", "build", "program", "function", "feature", "refactor"],
  codeReview: ["review", "pr ", "pull request", "diff", "critique", "audit"],
  debugging: ["debug", "bug", "error", "stack trace", "crash", "fix", "root cause"],
  reasoning: ["reason", "think", "analyz", "logic", "complex", "hard problem"],
  longContext: ["long", "large", "whole repo", "codebase", "book", "document", "corpus", "huge"],
  summarization: ["summar", "tldr", "condense", "digest", "recap", "notes"],
  extraction: ["extract", "json", "structured", "parse", "fields", "schema", "scrape"],
  creative: ["creative", "story", "copy", "marketing", "poem", "blog", "script", "brand"],
  math: ["math", "proof", "calculus", "statistic", "quant", "equation", "algebra"],
  multilingual: ["translat", "language", "arabic", "french", "spanish", "chinese", "multilingual"],
  vision: ["image", "screenshot", "vision", "diagram", "photo", "ocr", "pdf", "chart"],
  agentic: ["agent", "tool", "autonom", "workflow", "browser", "mcp", "loop"],
  speed: ["fast", "quick", "latency", "realtime", "instant", "autocomplete", "snappy"],
  cheapness: ["cheap", "budget", "cost", "bulk", "volume", "free", "afford"],
  instruction: ["follow", "instruction", "format", "strict", "reliable", "consistent"],
  quality: ["best", "smartest", "frontier", "highest quality", "top"],
};

export function taskFromText(text: string): Task {
  const lower = ` ${text.toLowerCase()} `;
  const weights: Record<string, number> = {};
  for (const [axis, keys] of Object.entries(KEYWORDS)) {
    let hits = 0;
    for (const k of keys) if (lower.includes(k)) hits++;
    if (hits) weights[axis] = Math.min(5, 2 + hits);
  }
  if (!Object.keys(weights).length) {
    Object.assign(weights, { quality: 4, reasoning: 3, instruction: 3 });
  }

  const requires: Task["requires"] = {};
  if (weights.vision) requires.vision = true;
  if (weights.agentic) requires.tools = true;
  if (lower.includes("json") || lower.includes("structured")) requires.json = true;

  const now = new Date().toISOString();
  return {
    id: -1,
    slug: "adhoc",
    label: text.trim().slice(0, 80) || "Custom request",
    description: text.trim(),
    weights,
    requires,
    pinnedModelId: null,
    builtin: false,
    createdAt: now,
    updatedAt: now,
  };
}
