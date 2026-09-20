import { getDb } from "./db";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";
import type {
  Model,
  ModelInput,
  Provider,
  ProviderInput,
  Task,
  TaskInput,
} from "./types";

/* ------------------------------------------------------------------ utils */

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || `item-${Date.now()}`
  );
}

function uniqueSlug(table: "providers" | "tasks", base: string, ignoreId?: number): string {
  const db = getDb();
  let slug = slugify(base);
  let n = 1;
  for (;;) {
    const row = db
      .prepare(`SELECT id FROM ${table} WHERE slug = ?`)
      .get(slug) as { id: number } | undefined;
    if (!row || row.id === ignoreId) return slug;
    slug = `${slugify(base)}-${++n}`;
  }
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const v = JSON.parse(raw);
    return v == null ? fallback : (v as T);
  } catch {
    return fallback;
  }
}

const clamp = (n: unknown, lo = 0, hi = 100, dflt = 0): number => {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return dflt;
  return Math.min(hi, Math.max(lo, v));
};

/* -------------------------------------------------------------- providers */

interface ProviderRow {
  id: number;
  slug: string;
  name: string;
  kind: string;
  base_url: string;
  chat_path: string;
  models_path: string;
  auth_type: string;
  auth_header: string;
  auth_query: string;
  headers_json: string;
  meta_json: string;
  api_key_enc: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function mapProvider(r: ProviderRow): Provider {
  const key = decryptSecret(r.api_key_enc);
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    kind: r.kind as Provider["kind"],
    baseUrl: r.base_url,
    chatPath: r.chat_path,
    modelsPath: r.models_path,
    authType: r.auth_type as Provider["authType"],
    authHeaderName: r.auth_header,
    authQueryName: r.auth_query,
    headers: parseJson<Record<string, string>>(r.headers_json, {}),
    meta: parseJson<Record<string, string>>(r.meta_json, {}),
    enabled: !!r.enabled,
    hasKey: key.length > 0,
    keyPreview: maskSecret(key),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listProviders(): Provider[] {
  return (
    getDb()
      .prepare("SELECT * FROM providers ORDER BY kind, name")
      .all() as ProviderRow[]
  ).map(mapProvider);
}

export function getProvider(id: number): Provider | null {
  const r = getDb().prepare("SELECT * FROM providers WHERE id = ?").get(id) as
    | ProviderRow
    | undefined;
  return r ? mapProvider(r) : null;
}

/** Returns the decrypted key — server-side only, never serialize this. */
export function getProviderSecret(id: number): string {
  const r = getDb()
    .prepare("SELECT api_key_enc FROM providers WHERE id = ?")
    .get(id) as { api_key_enc: string } | undefined;
  return decryptSecret(r?.api_key_enc);
}

export function createProvider(input: ProviderInput): Provider {
  const db = getDb();
  const slug = uniqueSlug("providers", input.slug || input.name);
  const info = db
    .prepare(
      `INSERT INTO providers
        (slug, name, kind, base_url, chat_path, models_path, auth_type, auth_header,
         auth_query, headers_json, meta_json, api_key_enc, enabled)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      slug,
      input.name.trim(),
      input.kind ?? "custom",
      (input.baseUrl ?? "").trim(),
      input.chatPath ?? "/chat/completions",
      input.modelsPath ?? "/models",
      input.authType ?? "bearer",
      input.authHeaderName ?? "Authorization",
      input.authQueryName ?? "",
      JSON.stringify(input.headers ?? {}),
      JSON.stringify(input.meta ?? {}),
      input.apiKey ? encryptSecret(input.apiKey) : "",
      input.enabled === false ? 0 : 1,
    );
  return getProvider(Number(info.lastInsertRowid))!;
}

export function updateProvider(id: number, input: Partial<ProviderInput>): Provider | null {
  const db = getDb();
  const existing = getProvider(id);
  if (!existing) return null;

  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => {
    sets.push(`${col} = ?`);
    vals.push(v);
  };

  if (input.name !== undefined) set("name", input.name.trim());
  if (input.slug !== undefined) set("slug", uniqueSlug("providers", input.slug, id));
  if (input.kind !== undefined) set("kind", input.kind);
  if (input.baseUrl !== undefined) set("base_url", input.baseUrl.trim());
  if (input.chatPath !== undefined) set("chat_path", input.chatPath);
  if (input.modelsPath !== undefined) set("models_path", input.modelsPath);
  if (input.authType !== undefined) set("auth_type", input.authType);
  if (input.authHeaderName !== undefined) set("auth_header", input.authHeaderName);
  if (input.authQueryName !== undefined) set("auth_query", input.authQueryName);
  if (input.headers !== undefined) set("headers_json", JSON.stringify(input.headers));
  if (input.meta !== undefined) set("meta_json", JSON.stringify(input.meta));
  if (input.enabled !== undefined) set("enabled", input.enabled ? 1 : 0);
  // apiKey: undefined = keep, "" = clear, value = replace
  if (input.apiKey !== undefined) {
    set("api_key_enc", input.apiKey ? encryptSecret(input.apiKey) : "");
  }

  if (!sets.length) return existing;
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  db.prepare(`UPDATE providers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getProvider(id);
}

export function deleteProvider(id: number): boolean {
  return getDb().prepare("DELETE FROM providers WHERE id = ?").run(id).changes > 0;
}

/* ----------------------------------------------------------------- models */

interface ModelRow {
  id: number;
  provider_id: number;
  provider_slug: string;
  provider_name: string;
  model_id: string;
  label: string;
  quality: number;
  speed: number;
  cheapness: number;
  context_window: number;
  max_output: number;
  input_cost: number;
  output_cost: number;
  skills_json: string;
  features_json: string;
  tags_json: string;
  notes: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

const MODEL_SELECT = `
  SELECT m.*, p.slug AS provider_slug, p.name AS provider_name
  FROM models m JOIN providers p ON p.id = m.provider_id
`;

function mapModel(r: ModelRow): Model {
  const feat = parseJson<Record<string, boolean>>(r.features_json, {});
  return {
    id: r.id,
    providerId: r.provider_id,
    providerSlug: r.provider_slug,
    providerName: r.provider_name,
    modelId: r.model_id,
    label: r.label || r.model_id,
    quality: r.quality,
    speed: r.speed,
    cheapness: r.cheapness,
    contextWindow: r.context_window,
    maxOutput: r.max_output,
    inputCost: r.input_cost,
    outputCost: r.output_cost,
    skills: parseJson<Record<string, number>>(r.skills_json, {}),
    features: {
      tools: !!feat.tools,
      vision: !!feat.vision,
      json: !!feat.json,
      streaming: !!feat.streaming,
      reasoning: !!feat.reasoning,
      audio: !!feat.audio,
      embedding: !!feat.embedding,
    },
    tags: parseJson<string[]>(r.tags_json, []),
    notes: r.notes,
    enabled: !!r.enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listModels(opts: { enabledOnly?: boolean } = {}): Model[] {
  const where = opts.enabledOnly ? "WHERE m.enabled = 1 AND p.enabled = 1" : "";
  return (
    getDb()
      .prepare(`${MODEL_SELECT} ${where} ORDER BY p.name, m.label`)
      .all() as ModelRow[]
  ).map(mapModel);
}

export function getModel(id: number): Model | null {
  const r = getDb().prepare(`${MODEL_SELECT} WHERE m.id = ?`).get(id) as
    | ModelRow
    | undefined;
  return r ? mapModel(r) : null;
}

function normalizeSkills(skills?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(skills ?? {})) {
    const key = k.trim();
    if (key) out[key] = clamp(v, 0, 100, 0);
  }
  return out;
}

export function createModel(input: ModelInput): Model {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO models
        (provider_id, model_id, label, quality, speed, cheapness, context_window, max_output,
         input_cost, output_cost, skills_json, features_json, tags_json, notes, enabled)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(provider_id, model_id) DO UPDATE SET
         label = excluded.label, updated_at = datetime('now')`,
    )
    .run(
      input.providerId,
      input.modelId.trim(),
      (input.label || input.modelId).trim(),
      clamp(input.quality, 0, 100, 60),
      clamp(input.speed, 0, 100, 60),
      clamp(input.cheapness, 0, 100, 60),
      Math.max(0, Number(input.contextWindow) || 0),
      Math.max(0, Number(input.maxOutput) || 0),
      Math.max(0, Number(input.inputCost) || 0),
      Math.max(0, Number(input.outputCost) || 0),
      JSON.stringify(normalizeSkills(input.skills)),
      JSON.stringify(input.features ?? {}),
      JSON.stringify(input.tags ?? []),
      input.notes ?? "",
      input.enabled === false ? 0 : 1,
    );
  const id = Number(info.lastInsertRowid);
  if (id) {
    const m = getModel(id);
    if (m) return m;
  }
  const r = getDb()
    .prepare(`${MODEL_SELECT} WHERE m.provider_id = ? AND m.model_id = ?`)
    .get(input.providerId, input.modelId.trim()) as ModelRow;
  return mapModel(r);
}

export function updateModel(id: number, input: Partial<ModelInput>): Model | null {
  const existing = getModel(id);
  if (!existing) return null;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (c: string, v: unknown) => {
    sets.push(`${c} = ?`);
    vals.push(v);
  };

  if (input.providerId !== undefined) set("provider_id", input.providerId);
  if (input.modelId !== undefined) set("model_id", input.modelId.trim());
  if (input.label !== undefined) set("label", input.label.trim());
  if (input.quality !== undefined) set("quality", clamp(input.quality, 0, 100, 60));
  if (input.speed !== undefined) set("speed", clamp(input.speed, 0, 100, 60));
  if (input.cheapness !== undefined) set("cheapness", clamp(input.cheapness, 0, 100, 60));
  if (input.contextWindow !== undefined)
    set("context_window", Math.max(0, Number(input.contextWindow) || 0));
  if (input.maxOutput !== undefined)
    set("max_output", Math.max(0, Number(input.maxOutput) || 0));
  if (input.inputCost !== undefined)
    set("input_cost", Math.max(0, Number(input.inputCost) || 0));
  if (input.outputCost !== undefined)
    set("output_cost", Math.max(0, Number(input.outputCost) || 0));
  if (input.skills !== undefined)
    set("skills_json", JSON.stringify(normalizeSkills(input.skills)));
  if (input.features !== undefined)
    set("features_json", JSON.stringify({ ...existing.features, ...input.features }));
  if (input.tags !== undefined) set("tags_json", JSON.stringify(input.tags));
  if (input.notes !== undefined) set("notes", input.notes);
  if (input.enabled !== undefined) set("enabled", input.enabled ? 1 : 0);

  if (!sets.length) return existing;
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  getDb().prepare(`UPDATE models SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getModel(id);
}

export function deleteModel(id: number): boolean {
  return getDb().prepare("DELETE FROM models WHERE id = ?").run(id).changes > 0;
}

/* ------------------------------------------------------------------ tasks */

interface TaskRow {
  id: number;
  slug: string;
  label: string;
  description: string;
  weights_json: string;
  requires_json: string;
  pinned_model_id: number | null;
  builtin: number;
  created_at: string;
  updated_at: string;
}

function mapTask(r: TaskRow): Task {
  return {
    id: r.id,
    slug: r.slug,
    label: r.label,
    description: r.description,
    weights: parseJson<Record<string, number>>(r.weights_json, {}),
    requires: parseJson<Task["requires"]>(r.requires_json, {}),
    pinnedModelId: r.pinned_model_id,
    builtin: !!r.builtin,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listTasks(): Task[] {
  return (
    getDb().prepare("SELECT * FROM tasks ORDER BY builtin DESC, label").all() as TaskRow[]
  ).map(mapTask);
}

export function getTask(id: number): Task | null {
  const r = getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
    | TaskRow
    | undefined;
  return r ? mapTask(r) : null;
}

export function getTaskBySlug(slug: string): Task | null {
  const r = getDb().prepare("SELECT * FROM tasks WHERE slug = ?").get(slug) as
    | TaskRow
    | undefined;
  return r ? mapTask(r) : null;
}

function normalizeWeights(w?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(w ?? {})) {
    const key = k.trim();
    const num = clamp(v, 0, 10, 0);
    if (key && num > 0) out[key] = num;
  }
  return out;
}

export function createTask(input: TaskInput): Task {
  const slug = uniqueSlug("tasks", input.slug || input.label);
  const info = getDb()
    .prepare(
      `INSERT INTO tasks (slug, label, description, weights_json, requires_json, pinned_model_id, builtin)
       VALUES (?,?,?,?,?,?,0)`,
    )
    .run(
      slug,
      input.label.trim(),
      input.description ?? "",
      JSON.stringify(normalizeWeights(input.weights)),
      JSON.stringify(input.requires ?? {}),
      input.pinnedModelId ?? null,
    );
  return getTask(Number(info.lastInsertRowid))!;
}

export function updateTask(id: number, input: Partial<TaskInput>): Task | null {
  const existing = getTask(id);
  if (!existing) return null;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (c: string, v: unknown) => {
    sets.push(`${c} = ?`);
    vals.push(v);
  };
  if (input.label !== undefined) set("label", input.label.trim());
  if (input.slug !== undefined) set("slug", uniqueSlug("tasks", input.slug, id));
  if (input.description !== undefined) set("description", input.description);
  if (input.weights !== undefined)
    set("weights_json", JSON.stringify(normalizeWeights(input.weights)));
  if (input.requires !== undefined) set("requires_json", JSON.stringify(input.requires));
  if (input.pinnedModelId !== undefined) set("pinned_model_id", input.pinnedModelId);
  if (!sets.length) return existing;
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  getDb().prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getTask(id);
}

export function deleteTask(id: number): boolean {
  return getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id).changes > 0;
}
