import fs from "node:fs";

import Database from "better-sqlite3";

import { profilePaths } from "./paths";

export interface ModelUsageRow {
  model: string;
  billingProvider: string;
  apiCallCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
  lastSeen: number | null;
}

export interface ProfileUsageSummary {
  rows: ModelUsageRow[];
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  byProvider: { provider: string; calls: number; tokens: number; costUsd: number }[];
}

const EMPTY: ProfileUsageSummary = {
  rows: [],
  totalCalls: 0,
  totalTokens: 0,
  totalCostUsd: 0,
  byProvider: [],
};

/**
 * Aggregate `session_model_usage` across every session for one profile,
 * grouped by model. Opened readonly so this dashboard can never corrupt a
 * live Hermes session's WAL/journal state — Hermes itself is the only
 * writer.
 *
 * Cost here is best-effort: Hermes only fills `actual_cost_usd` for
 * providers with a billing API (falls back to `estimated_cost_usd`, which
 * itself can be 0 for providers with no known per-token pricing, e.g. most
 * local Ollama runs). Never presented as an exact bill — see the "estimated"
 * label the UI must keep next to it.
 */
export function readProfileUsage(profileId: string): ProfileUsageSummary {
  const { stateDbPath } = profilePaths(profileId);
  if (!fs.existsSync(stateDbPath)) return EMPTY;

  let db: Database.Database;
  try {
    db = new Database(stateDbPath, { readonly: true, fileMustExist: true });
  } catch {
    return EMPTY;
  }

  try {
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_model_usage'")
      .get();
    if (!tableExists) return EMPTY;

    const grouped = db
      .prepare(
        `SELECT
           model,
           MAX(billing_provider) AS billing_provider,
           SUM(api_call_count) AS api_call_count,
           SUM(input_tokens) AS input_tokens,
           SUM(output_tokens) AS output_tokens,
           SUM(cache_read_tokens) AS cache_read_tokens,
           SUM(cache_write_tokens) AS cache_write_tokens,
           SUM(reasoning_tokens) AS reasoning_tokens,
           SUM(estimated_cost_usd) AS estimated_cost_usd,
           SUM(actual_cost_usd) AS actual_cost_usd,
           MAX(last_seen) AS last_seen
         FROM session_model_usage
         GROUP BY model
         ORDER BY (SUM(actual_cost_usd) + SUM(estimated_cost_usd)) DESC, SUM(api_call_count) DESC`,
      )
      .all() as Array<{
      model: string;
      billing_provider: string | null;
      api_call_count: number | null;
      input_tokens: number | null;
      output_tokens: number | null;
      cache_read_tokens: number | null;
      cache_write_tokens: number | null;
      reasoning_tokens: number | null;
      estimated_cost_usd: number | null;
      actual_cost_usd: number | null;
      last_seen: number | null;
    }>;

    const rows: ModelUsageRow[] = grouped.map((r) => ({
      model: r.model,
      billingProvider: r.billing_provider ?? "",
      apiCallCount: r.api_call_count ?? 0,
      inputTokens: r.input_tokens ?? 0,
      outputTokens: r.output_tokens ?? 0,
      cacheReadTokens: r.cache_read_tokens ?? 0,
      cacheWriteTokens: r.cache_write_tokens ?? 0,
      reasoningTokens: r.reasoning_tokens ?? 0,
      estimatedCostUsd: r.estimated_cost_usd ?? 0,
      actualCostUsd: r.actual_cost_usd ?? 0,
      lastSeen: r.last_seen ?? null,
    }));

    const byProviderMap = new Map<string, { calls: number; tokens: number; costUsd: number }>();
    for (const r of rows) {
      const key = r.billingProvider || "unknown";
      const acc = byProviderMap.get(key) ?? { calls: 0, tokens: 0, costUsd: 0 };
      acc.calls += r.apiCallCount;
      acc.tokens += r.inputTokens + r.outputTokens;
      acc.costUsd += r.actualCostUsd || r.estimatedCostUsd;
      byProviderMap.set(key, acc);
    }

    return {
      rows,
      totalCalls: rows.reduce((n, r) => n + r.apiCallCount, 0),
      totalTokens: rows.reduce((n, r) => n + r.inputTokens + r.outputTokens, 0),
      totalCostUsd: rows.reduce((n, r) => n + (r.actualCostUsd || r.estimatedCostUsd), 0),
      byProvider: Array.from(byProviderMap.entries())
        .map(([provider, v]) => ({ provider, ...v }))
        .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls),
    };
  } finally {
    db.close();
  }
}
