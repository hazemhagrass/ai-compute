import { getDb } from "./db";

export interface UsageEventInput {
  providerId?: number | null;
  providerSlug?: string;
  providerName?: string;
  modelRowId?: number | null;
  modelId?: string;
  modelLabel?: string;
  taskSlug?: string;
  taskLabel?: string;
  /** playground | recommend | test | api */
  source?: string;
  systemPrompt?: string;
  prompt?: string;
  response?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  contextWindow?: number;
  costUsd?: number;
  inputCostUsd?: number;
  outputCostUsd?: number;
  latencyMs?: number;
  estimated?: boolean;
  ok?: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface UsageEvent {
  id: number;
  ts: string;
  providerId: number | null;
  providerSlug: string;
  providerName: string;
  modelRowId: number | null;
  modelId: string;
  modelLabel: string;
  taskSlug: string;
  taskLabel: string;
  source: string;
  systemPrompt: string;
  prompt: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  contextWindow: number;
  /** total_tokens / context_window, 0-1 — "how full was my context" */
  contextFill: number;
  costUsd: number;
  inputCostUsd: number;
  outputCostUsd: number;
  latencyMs: number;
  tokensPerSec: number;
  estimated: boolean;
  ok: boolean;
  error: string;
  meta: Record<string, unknown>;
}

interface UsageRow {
  id: number;
  ts: string;
  provider_id: number | null;
  provider_slug: string;
  provider_name: string;
  model_row_id: number | null;
  model_id: string;
  model_label: string;
  task_slug: string;
  task_label: string;
  source: string;
  system_prompt: string;
  prompt: string;
  response: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
  context_window: number;
  cost_usd: number;
  input_cost_usd: number;
  output_cost_usd: number;
  latency_ms: number;
  tokens_per_sec: number;
  estimated: number;
  ok: number;
  error: string;
  meta_json: string;
}

function mapEvent(r: UsageRow): UsageEvent {
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(r.meta_json) ?? {};
  } catch {
    meta = {};
  }
  return {
    id: r.id,
    ts: r.ts,
    providerId: r.provider_id,
    providerSlug: r.provider_slug,
    providerName: r.provider_name,
    modelRowId: r.model_row_id,
    modelId: r.model_id,
    modelLabel: r.model_label || r.model_id,
    taskSlug: r.task_slug,
    taskLabel: r.task_label,
    source: r.source,
    systemPrompt: r.system_prompt,
    prompt: r.prompt,
    response: r.response,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    totalTokens: r.total_tokens,
    cachedTokens: r.cached_tokens,
    reasoningTokens: r.reasoning_tokens,
    contextWindow: r.context_window,
    contextFill:
      r.context_window > 0 ? Math.min(1, r.total_tokens / r.context_window) : 0,
    costUsd: r.cost_usd,
    inputCostUsd: r.input_cost_usd,
    outputCostUsd: r.output_cost_usd,
    latencyMs: r.latency_ms,
    tokensPerSec: r.tokens_per_sec,
    estimated: !!r.estimated,
    ok: !!r.ok,
    error: r.error,
    meta,
  };
}

/** Cost in USD given per-1M-token prices. */
export function computeCost(
  inputTokens: number,
  outputTokens: number,
  inputCostPer1M: number,
  outputCostPer1M: number,
): { inputCostUsd: number; outputCostUsd: number; costUsd: number } {
  const inputCostUsd = (inputTokens / 1_000_000) * (inputCostPer1M || 0);
  const outputCostUsd = (outputTokens / 1_000_000) * (outputCostPer1M || 0);
  return { inputCostUsd, outputCostUsd, costUsd: inputCostUsd + outputCostUsd };
}

export function recordUsage(input: UsageEventInput): UsageEvent {
  const inputTokens = Math.max(0, Math.round(input.inputTokens ?? 0));
  const outputTokens = Math.max(0, Math.round(input.outputTokens ?? 0));
  const totalTokens = Math.max(
    0,
    Math.round(input.totalTokens ?? inputTokens + outputTokens),
  );
  const latencyMs = Math.max(0, Math.round(input.latencyMs ?? 0));
  const tokensPerSec = latencyMs > 0 ? (outputTokens / latencyMs) * 1000 : 0;

  const info = getDb()
    .prepare(
      `INSERT INTO usage_events
        (provider_id, provider_slug, provider_name, model_row_id, model_id, model_label,
         task_slug, task_label, source, system_prompt, prompt, response,
         input_tokens, output_tokens, total_tokens, cached_tokens, reasoning_tokens,
         context_window, cost_usd, input_cost_usd, output_cost_usd,
         latency_ms, tokens_per_sec, estimated, ok, error, meta_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      input.providerId ?? null,
      input.providerSlug ?? "",
      input.providerName ?? "",
      input.modelRowId ?? null,
      input.modelId ?? "",
      input.modelLabel ?? "",
      input.taskSlug ?? "",
      input.taskLabel ?? "",
      input.source ?? "playground",
      input.systemPrompt ?? "",
      input.prompt ?? "",
      input.response ?? "",
      inputTokens,
      outputTokens,
      totalTokens,
      Math.max(0, Math.round(input.cachedTokens ?? 0)),
      Math.max(0, Math.round(input.reasoningTokens ?? 0)),
      Math.max(0, Math.round(input.contextWindow ?? 0)),
      Math.max(0, input.costUsd ?? 0),
      Math.max(0, input.inputCostUsd ?? 0),
      Math.max(0, input.outputCostUsd ?? 0),
      latencyMs,
      tokensPerSec,
      input.estimated ? 1 : 0,
      input.ok === false ? 0 : 1,
      input.error ?? "",
      JSON.stringify(input.meta ?? {}),
    );

  const row = getDb()
    .prepare("SELECT * FROM usage_events WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as UsageRow;
  return mapEvent(row);
}

export interface LogQuery {
  limit?: number;
  offset?: number;
  providerId?: number;
  modelRowId?: number;
  taskSlug?: string;
  source?: string;
  okOnly?: boolean;
  errorsOnly?: boolean;
  /** ISO date or "YYYY-MM-DD" lower bound */
  since?: string;
  search?: string;
}

function whereClause(q: LogQuery): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (q.providerId) {
    parts.push("provider_id = ?");
    params.push(q.providerId);
  }
  if (q.modelRowId) {
    parts.push("model_row_id = ?");
    params.push(q.modelRowId);
  }
  if (q.taskSlug) {
    parts.push("task_slug = ?");
    params.push(q.taskSlug);
  }
  if (q.source) {
    parts.push("source = ?");
    params.push(q.source);
  }
  if (q.okOnly) parts.push("ok = 1");
  if (q.errorsOnly) parts.push("ok = 0");
  if (q.since) {
    parts.push("ts >= ?");
    params.push(q.since);
  }
  if (q.search) {
    parts.push("(prompt LIKE ? OR response LIKE ? OR model_id LIKE ?)");
    const like = `%${q.search}%`;
    params.push(like, like, like);
  }
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}

export function listUsage(q: LogQuery = {}): { events: UsageEvent[]; total: number } {
  const { sql, params } = whereClause(q);
  const limit = Math.min(500, Math.max(1, q.limit ?? 50));
  const offset = Math.max(0, q.offset ?? 0);
  const total = (
    getDb().prepare(`SELECT COUNT(*) AS n FROM usage_events ${sql}`).get(...params) as {
      n: number;
    }
  ).n;
  const rows = getDb()
    .prepare(`SELECT * FROM usage_events ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as UsageRow[];
  return { events: rows.map(mapEvent), total };
}

export function getUsageEvent(id: number): UsageEvent | null {
  const r = getDb().prepare("SELECT * FROM usage_events WHERE id = ?").get(id) as
    | UsageRow
    | undefined;
  return r ? mapEvent(r) : null;
}

export function deleteUsageEvent(id: number): boolean {
  return getDb().prepare("DELETE FROM usage_events WHERE id = ?").run(id).changes > 0;
}

export function clearUsage(): number {
  return getDb().prepare("DELETE FROM usage_events").run().changes;
}

/* -------------------------------------------------------------- analytics */

export interface Bucket {
  key: string;
  label: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  avgTokensPerSec: number;
  errors: number;
  share: number; // 0-1 of total cost
  tokenShare: number; // 0-1 of total tokens
}

export interface Analytics {
  range: { since: string; days: number };
  totals: {
    calls: number;
    errors: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedTokens: number;
    reasoningTokens: number;
    costUsd: number;
    avgLatencyMs: number;
    avgTokensPerSec: number;
    avgCostPerCall: number;
    estimatedShare: number;
  };
  byModel: Bucket[];
  byProvider: Bucket[];
  byTask: Bucket[];
  bySource: Bucket[];
  daily: {
    day: string;
    calls: number;
    costUsd: number;
    totalTokens: number;
    errors: number;
  }[];
  hourly: { hour: number; calls: number; costUsd: number }[];
  topPrompts: {
    id: number;
    ts: string;
    modelLabel: string;
    costUsd: number;
    totalTokens: number;
    preview: string;
  }[];
  contextPressure: {
    modelLabel: string;
    avgFill: number;
    maxFill: number;
    contextWindow: number;
  }[];
}

interface GroupRow {
  key: string | null;
  label: string | null;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  avg_latency: number;
  avg_tps: number;
  errors: number;
}

function groupBy(
  keyCol: string,
  labelCol: string,
  since: string,
  totalCost: number,
  totalTokens: number,
): Bucket[] {
  const rows = getDb()
    .prepare(
      `SELECT ${keyCol} AS key, ${labelCol} AS label,
              COUNT(*) AS calls,
              SUM(input_tokens) AS input_tokens,
              SUM(output_tokens) AS output_tokens,
              SUM(total_tokens) AS total_tokens,
              SUM(cost_usd) AS cost_usd,
              AVG(latency_ms) AS avg_latency,
              AVG(tokens_per_sec) AS avg_tps,
              SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS errors
       FROM usage_events
       WHERE ts >= ?
       GROUP BY ${keyCol}
       ORDER BY cost_usd DESC, total_tokens DESC`,
    )
    .all(since) as GroupRow[];

  return rows
    .filter((r) => r.key !== null && r.key !== "")
    .map((r) => ({
      key: String(r.key),
      label: r.label || String(r.key),
      calls: r.calls,
      inputTokens: r.input_tokens ?? 0,
      outputTokens: r.output_tokens ?? 0,
      totalTokens: r.total_tokens ?? 0,
      costUsd: r.cost_usd ?? 0,
      avgLatencyMs: Math.round(r.avg_latency ?? 0),
      avgTokensPerSec: Number((r.avg_tps ?? 0).toFixed(1)),
      errors: r.errors ?? 0,
      share: totalCost > 0 ? (r.cost_usd ?? 0) / totalCost : 0,
      tokenShare: totalTokens > 0 ? (r.total_tokens ?? 0) / totalTokens : 0,
    }));
}

export function analytics(days = 30): Analytics {
  const db = getDb();
  const since = new Date(Date.now() - days * 86400_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  const t = db
    .prepare(
      `SELECT COUNT(*) AS calls,
              SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS errors,
              SUM(input_tokens) AS input_tokens,
              SUM(output_tokens) AS output_tokens,
              SUM(total_tokens) AS total_tokens,
              SUM(cached_tokens) AS cached_tokens,
              SUM(reasoning_tokens) AS reasoning_tokens,
              SUM(cost_usd) AS cost_usd,
              AVG(latency_ms) AS avg_latency,
              AVG(tokens_per_sec) AS avg_tps,
              AVG(estimated) AS est_share
       FROM usage_events WHERE ts >= ?`,
    )
    .get(since) as Record<string, number | null>;

  const calls = t.calls ?? 0;
  const costUsd = t.cost_usd ?? 0;
  const totalTokens = t.total_tokens ?? 0;

  const daily = (
    db
      .prepare(
        `SELECT substr(ts,1,10) AS day, COUNT(*) AS calls, SUM(cost_usd) AS cost_usd,
                SUM(total_tokens) AS total_tokens,
                SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS errors
         FROM usage_events WHERE ts >= ? GROUP BY day ORDER BY day`,
      )
      .all(since) as {
      day: string;
      calls: number;
      cost_usd: number;
      total_tokens: number;
      errors: number;
    }[]
  ).map((r) => ({
    day: r.day,
    calls: r.calls,
    costUsd: r.cost_usd ?? 0,
    totalTokens: r.total_tokens ?? 0,
    errors: r.errors ?? 0,
  }));

  const hourly = (
    db
      .prepare(
        `SELECT CAST(substr(ts,12,2) AS INTEGER) AS hour, COUNT(*) AS calls, SUM(cost_usd) AS cost_usd
         FROM usage_events WHERE ts >= ? GROUP BY hour ORDER BY hour`,
      )
      .all(since) as { hour: number; calls: number; cost_usd: number }[]
  ).map((r) => ({ hour: r.hour, calls: r.calls, costUsd: r.cost_usd ?? 0 }));

  const topPrompts = (
    db
      .prepare(
        `SELECT id, ts, model_label, model_id, cost_usd, total_tokens, substr(prompt,1,160) AS preview
         FROM usage_events WHERE ts >= ? ORDER BY cost_usd DESC LIMIT 10`,
      )
      .all(since) as {
      id: number;
      ts: string;
      model_label: string;
      model_id: string;
      cost_usd: number;
      total_tokens: number;
      preview: string;
    }[]
  ).map((r) => ({
    id: r.id,
    ts: r.ts,
    modelLabel: r.model_label || r.model_id,
    costUsd: r.cost_usd ?? 0,
    totalTokens: r.total_tokens ?? 0,
    preview: r.preview ?? "",
  }));

  const contextPressure = (
    db
      .prepare(
        `SELECT model_label, model_id, context_window,
                AVG(CAST(total_tokens AS REAL) / context_window) AS avg_fill,
                MAX(CAST(total_tokens AS REAL) / context_window) AS max_fill
         FROM usage_events
         WHERE ts >= ? AND context_window > 0
         GROUP BY model_row_id
         ORDER BY avg_fill DESC LIMIT 10`,
      )
      .all(since) as {
      model_label: string;
      model_id: string;
      context_window: number;
      avg_fill: number;
      max_fill: number;
    }[]
  ).map((r) => ({
    modelLabel: r.model_label || r.model_id,
    contextWindow: r.context_window,
    avgFill: Math.min(1, r.avg_fill ?? 0),
    maxFill: Math.min(1, r.max_fill ?? 0),
  }));

  return {
    range: { since, days },
    totals: {
      calls,
      errors: t.errors ?? 0,
      inputTokens: t.input_tokens ?? 0,
      outputTokens: t.output_tokens ?? 0,
      totalTokens,
      cachedTokens: t.cached_tokens ?? 0,
      reasoningTokens: t.reasoning_tokens ?? 0,
      costUsd,
      avgLatencyMs: Math.round(t.avg_latency ?? 0),
      avgTokensPerSec: Number((t.avg_tps ?? 0).toFixed(1)),
      avgCostPerCall: calls > 0 ? costUsd / calls : 0,
      estimatedShare: t.est_share ?? 0,
    },
    byModel: groupBy("model_row_id", "model_label", since, costUsd, totalTokens),
    byProvider: groupBy("provider_id", "provider_name", since, costUsd, totalTokens),
    byTask: groupBy("task_slug", "task_label", since, costUsd, totalTokens),
    bySource: groupBy("source", "source", since, costUsd, totalTokens),
    daily,
    hourly,
    topPrompts,
    contextPressure,
  };
}
