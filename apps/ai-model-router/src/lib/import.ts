import { z } from "zod";

import { getDb } from "./db";
import {
  authType,
  featuresSchema,
  providerKind,
  requiresSchema,
} from "./schemas";
import { encryptSecret } from "./crypto";

/**
 * Config import: the inverse of `GET /api/export`.
 *
 * Reads a `version: 1` config payload (providers, models, tasks, never usage
 * history) and recreates it on a fresh or existing database. Every row is
 * validated with Zod before a single write happens, and the whole import runs
 * inside one SQLite transaction, so a bad file changes nothing.
 */

export type ImportConflictMode = "skip" | "upsert";

export interface ImportOptions {
  /**
   * What to do when a row already exists (matched by provider slug, task
   * slug, or provider slug + model id). Default "skip": existing rows are
   * left untouched. "upsert" updates them in place. Rows are never silently
   * duplicated.
   */
  conflict?: ImportConflictMode;
}

export interface SectionStats {
  inserted: number;
  skipped: number;
  updated: number;
}

export interface ImportSummary {
  providers: SectionStats;
  models: SectionStats;
  tasks: SectionStats;
  /**
   * Providers that referenced a masked or placeholder key. Their key slot is
   * left empty on purpose: a masked string is not a credential, and storing
   * it as if it were one fails only when the first real request is made.
   */
  maskedKeys: string[];
}

/** One offending row, in a shape a user can act on. */
export interface ImportRowError {
  section: "providers" | "models" | "tasks";
  index: number;
  issues: string[];
}

export class ImportValidationError extends Error {
  readonly issues: ImportRowError[];

  constructor(issues: ImportRowError[]) {
    const preview = issues
      .slice(0, 3)
      .map((e) => `${e.section}[${String(e.index)}]: ${e.issues[0] ?? "invalid"}`)
      .join("; ");
    super(
      `config import failed validation: ${String(issues.length)} invalid row(s) (${preview}` +
        `${issues.length > 3 ? ", ..." : ""})`,
    );
    this.name = "ImportValidationError";
    this.issues = issues;
  }
}

/* --------------------------------------------------------------- schemas */

const score = z.coerce.number().min(0).max(100);
const nonNegative = z.coerce.number().min(0);

/**
 * Plaintext key, only ever accepted from the clearly marked
 * `plaintextApiKey` field. An empty string is treated as "no key supplied"
 * rather than "clear the key": importing a backup must not be able to wipe
 * credentials that are already stored.
 */
const plaintextApiKey = z.string().min(1).optional();

const exportedProviderSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  slug: z.string().trim().min(1).optional(),
  kind: providerKind.optional(),
  baseUrl: z.string().trim().min(1, "baseUrl is required"),
  chatPath: z.string().optional(),
  modelsPath: z.string().optional(),
  authType: authType.optional(),
  authHeaderName: z.string().optional(),
  authQueryName: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  meta: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
  plaintextApiKey,
});

const exportedModelSchema = z.object({
  /**
   * Models are linked by provider slug, not by row id: ids from the machine
   * that produced the export are meaningless on the machine importing it.
   */
  providerSlug: z.string().trim().min(1, "providerSlug is required"),
  modelId: z.string().trim().min(1, "modelId is required"),
  label: z.string().optional(),
  quality: score.optional(),
  speed: score.optional(),
  cheapness: score.optional(),
  contextWindow: nonNegative.optional(),
  maxOutput: nonNegative.optional(),
  inputCost: nonNegative.optional(),
  outputCost: nonNegative.optional(),
  skills: z.record(z.string(), score).optional(),
  features: featuresSchema.optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
});

const exportedTaskSchema = z.object({
  label: z.string().trim().min(1, "label is required"),
  slug: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  weights: z.record(z.string(), z.coerce.number().min(0).max(10)).optional(),
  requires: requiresSchema.optional(),
  /**
   * Pins are exported by model row id, which only exists on the source
   * machine, so they cannot be honoured on import. The field is accepted
   * (an export carries it) but deliberately ignored.
   */
  pinnedModelId: z.coerce.number().int().positive().nullable().optional(),
});

export const configImportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().optional(),
  providers: z.array(z.unknown()).max(5000).optional(),
  models: z.array(z.unknown()).max(50_000).optional(),
  tasks: z.array(z.unknown()).max(5000).optional(),
});

export type ExportedProvider = z.infer<typeof exportedProviderSchema>;
export type ExportedModel = z.infer<typeof exportedModelSchema>;
export type ExportedTask = z.infer<typeof exportedTaskSchema>;

/* ---------------------------------------------------------- secret guard */

/**
 * True when a string is a masked key preview rather than a usable credential.
 *
 * Exports carry `hasKey` / `keyPreview` hints, and a hand-edited file may
 * contain an already-masked placeholder. Any of these must never reach the
 * encrypted key column.
 */
export function isMaskedSecret(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.includes("•") || v.includes("*") || v.includes("…")) return true;
  if (/^(x+|X+)$/.test(v)) return true;
  return /^(masked|redacted|placeholder)/i.test(v);
}

/* ------------------------------------------------------------------ parse */

interface ParsedConfig {
  providers: ExportedProvider[];
  models: ExportedModel[];
  tasks: ExportedTask[];
}

/**
 * Validate the raw payload row by row. Throws ImportValidationError listing
 * every bad row; nothing is written when even one row is wrong.
 */
export function parseConfigImport(raw: unknown): ParsedConfig {
  const top = configImportSchema.safeParse(raw);
  if (!top.success) {
    throw new ImportValidationError([
      {
        section: "providers",
        index: -1,
        issues: top.error.issues.map(
          (i) => `${i.path.join(".") || "payload"}: ${i.message}`,
        ),
      },
    ]);
  }

  const issues: ImportRowError[] = [];
  const collect = <T>(
    rows: unknown[] | undefined,
    schema: z.ZodType<T>,
    section: ImportRowError["section"],
  ): T[] => {
    const out: T[] = [];
    (rows ?? []).forEach((row, index) => {
      const r = schema.safeParse(row);
      if (r.success) {
        out.push(r.data);
      } else {
        issues.push({
          section,
          index,
          issues: r.error.issues.map(
            (i) => `${i.path.join(".") || "row"}: ${i.message}`,
          ),
        });
      }
    });
    return out;
  };

  const parsed: ParsedConfig = {
    providers: collect(top.data.providers, exportedProviderSchema, "providers"),
    models: collect(top.data.models, exportedModelSchema, "models"),
    tasks: collect(top.data.tasks, exportedTaskSchema, "tasks"),
  };

  if (issues.length > 0) throw new ImportValidationError(issues);
  return parsed;
}

/* ------------------------------------------------------------------ write */

const emptyStats = (): SectionStats => ({ inserted: 0, skipped: 0, updated: 0 });

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "imported"
  );
}

/**
 * Import a validated (or not yet validated) config payload.
 *
 * Validation happens up front and the writes run inside one transaction, so
 * any failure, malformed row, duplicate slug, dangling provider reference,
 * leaves the database exactly as it was.
 */
export function importConfig(
  rawPayload: unknown,
  options: ImportOptions = {},
): ImportSummary {
  const conflict: ImportConflictMode = options.conflict ?? "skip";
  const data = parseConfigImport(rawPayload);
  const db = getDb();

  const summary: ImportSummary = {
    providers: emptyStats(),
    models: emptyStats(),
    tasks: emptyStats(),
    maskedKeys: [],
  };

  db.transaction(() => {
    /* Providers, keyed by slug. */
    const providerIdBySlug = new Map<string, number>();
    for (const row of db
      .prepare("SELECT id, slug FROM providers")
      .all() as { id: number; slug: string }[]) {
      providerIdBySlug.set(row.slug, row.id);
    }

    const insertProvider = db.prepare(
      `INSERT INTO providers
        (slug, name, kind, base_url, chat_path, models_path, auth_type, auth_header,
         auth_query, headers_json, meta_json, enabled, api_key_enc)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const updateProvider = db.prepare(
      `UPDATE providers SET
         name = ?, kind = ?, base_url = ?, chat_path = ?, models_path = ?,
         auth_type = ?, auth_header = ?, auth_query = ?, headers_json = ?,
         meta_json = ?, enabled = ?, updated_at = datetime('now')
       WHERE id = ?`,
    );
    const updateProviderKey = db.prepare(
      `UPDATE providers SET api_key_enc = ?, updated_at = datetime('now') WHERE id = ?`,
    );

    for (const p of data.providers) {
      const slug = slugify(p.slug ?? p.name);
      const existingId = providerIdBySlug.get(slug);

      // A masked placeholder is never stored as a credential. Upsert mode
      // also refuses to touch the key column with one, so a backup made
      // after keys were entered cannot wipe them on re-import.
      let keyEnc: string | null = null;
      if (p.plaintextApiKey !== undefined) {
        if (isMaskedSecret(p.plaintextApiKey)) {
          summary.maskedKeys.push(slug);
        } else {
          keyEnc = encryptSecret(p.plaintextApiKey);
        }
      }

      const fields = [
        p.name,
        p.kind ?? "custom",
        p.baseUrl,
        p.chatPath ?? "/chat/completions",
        p.modelsPath ?? "/models",
        p.authType ?? "bearer",
        p.authHeaderName ?? "Authorization",
        p.authQueryName ?? "",
        JSON.stringify(p.headers ?? {}),
        JSON.stringify(p.meta ?? {}),
        p.enabled === false ? 0 : 1,
      ] as const;

      if (existingId === undefined) {
        const info = insertProvider.run(slug, ...fields, keyEnc ?? "");
        providerIdBySlug.set(slug, Number(info.lastInsertRowid));
        summary.providers.inserted++;
      } else if (conflict === "upsert") {
        updateProvider.run(...fields, existingId);
        if (keyEnc !== null) updateProviderKey.run(keyEnc, existingId);
        summary.providers.updated++;
      } else {
        summary.providers.skipped++;
      }
    }

    /* Models, keyed by provider slug + model id. */
    const insertModel = db.prepare(
      `INSERT INTO models
        (provider_id, model_id, label, quality, speed, cheapness, context_window, max_output,
         input_cost, output_cost, skills_json, features_json, tags_json, notes, enabled)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const updateModel = db.prepare(
      `UPDATE models SET
         label = ?, quality = ?, speed = ?, cheapness = ?, context_window = ?,
         max_output = ?, input_cost = ?, output_cost = ?, skills_json = ?,
         features_json = ?, tags_json = ?, notes = ?, enabled = ?,
         updated_at = datetime('now')
       WHERE provider_id = ? AND model_id = ?`,
    );
    const modelExists = db.prepare(
      "SELECT id FROM models WHERE provider_id = ? AND model_id = ?",
    );

    const clampScore = (v: number | undefined, dflt: number) =>
      Math.min(100, Math.max(0, v ?? dflt));
    const clampCount = (v: number | undefined) => Math.max(0, v ?? 0);

    for (const m of data.models) {
      const providerId = providerIdBySlug.get(m.providerSlug);
      if (providerId === undefined) {
        throw new Error(
          `models: no provider with slug "${m.providerSlug}" for model "${m.modelId}"`,
        );
      }

      const fields = [
        (m.label ?? m.modelId).trim(),
        clampScore(m.quality, 60),
        clampScore(m.speed, 60),
        clampScore(m.cheapness, 60),
        clampCount(m.contextWindow),
        clampCount(m.maxOutput),
        clampCount(m.inputCost),
        clampCount(m.outputCost),
        JSON.stringify(m.skills ?? {}),
        JSON.stringify(m.features ?? {}),
        JSON.stringify(m.tags ?? []),
        m.notes ?? "",
        m.enabled === false ? 0 : 1,
      ] as const;

      const existing = modelExists.get(providerId, m.modelId) as
        | { id: number }
        | undefined;
      if (!existing) {
        insertModel.run(providerId, m.modelId, ...fields);
        summary.models.inserted++;
      } else if (conflict === "upsert") {
        updateModel.run(...fields, providerId, m.modelId);
        summary.models.updated++;
      } else {
        summary.models.skipped++;
      }
    }

    /* Tasks, keyed by slug. Pins stay null: model ids do not transfer. */
    const insertTask = db.prepare(
      `INSERT INTO tasks (slug, label, description, weights_json, requires_json, pinned_model_id, builtin)
       VALUES (?,?,?,?,?,NULL,0)`,
    );
    const updateTask = db.prepare(
      `UPDATE tasks SET
         label = ?, description = ?, weights_json = ?, requires_json = ?,
         updated_at = datetime('now')
       WHERE slug = ?`,
    );
    const taskExists = db.prepare("SELECT id FROM tasks WHERE slug = ?");

    for (const t of data.tasks) {
      const slug = slugify(t.slug ?? t.label);
      const fields = [
        t.label,
        t.description ?? "",
        JSON.stringify(t.weights ?? {}),
        JSON.stringify(t.requires ?? {}),
      ] as const;

      const existing = taskExists.get(slug) as { id: number } | undefined;
      if (!existing) {
        insertTask.run(slug, ...fields);
        summary.tasks.inserted++;
      } else if (conflict === "upsert") {
        updateTask.run(...fields, slug);
        summary.tasks.updated++;
      } else {
        summary.tasks.skipped++;
      }
    }
  })();

  return summary;
}
