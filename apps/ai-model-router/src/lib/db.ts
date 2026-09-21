import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { DATA_DIR, DB_PATH } from "./paths";
import { seedProviders, seedTasks } from "./seed";

let db: Database.Database | null = null;

/** Lazily open (and migrate) the single-file SQLite database. */
export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  return db;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      slug            TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      kind            TEXT NOT NULL DEFAULT 'cloud',
      base_url        TEXT NOT NULL DEFAULT '',
      chat_path       TEXT NOT NULL DEFAULT '/chat/completions',
      models_path     TEXT NOT NULL DEFAULT '/models',
      auth_type       TEXT NOT NULL DEFAULT 'bearer',
      auth_header     TEXT NOT NULL DEFAULT 'Authorization',
      auth_query      TEXT NOT NULL DEFAULT '',
      headers_json    TEXT NOT NULL DEFAULT '{}',
      meta_json       TEXT NOT NULL DEFAULT '{}',
      api_key_enc     TEXT NOT NULL DEFAULT '',
      enabled         INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS models (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id     INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      model_id        TEXT NOT NULL,
      label           TEXT NOT NULL DEFAULT '',
      quality         REAL NOT NULL DEFAULT 60,
      speed           REAL NOT NULL DEFAULT 60,
      cheapness       REAL NOT NULL DEFAULT 60,
      context_window  INTEGER NOT NULL DEFAULT 0,
      max_output      INTEGER NOT NULL DEFAULT 0,
      input_cost      REAL NOT NULL DEFAULT 0,
      output_cost     REAL NOT NULL DEFAULT 0,
      skills_json     TEXT NOT NULL DEFAULT '{}',
      features_json   TEXT NOT NULL DEFAULT '{}',
      tags_json       TEXT NOT NULL DEFAULT '[]',
      notes           TEXT NOT NULL DEFAULT '',
      enabled         INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider_id, model_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      slug            TEXT NOT NULL UNIQUE,
      label           TEXT NOT NULL,
      description     TEXT NOT NULL DEFAULT '',
      weights_json    TEXT NOT NULL DEFAULT '{}',
      requires_json   TEXT NOT NULL DEFAULT '{}',
      pinned_model_id INTEGER REFERENCES models(id) ON DELETE SET NULL,
      builtin         INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- A recommendation the router produced, kept so a choice can be revisited
    -- later instead of re-running the ranking. Stores the task, the ranked
    -- list, and which model the user actually picked (nullable until chosen).
    CREATE TABLE IF NOT EXISTS recommendations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      ts           TEXT NOT NULL DEFAULT (datetime('now')),
      task_slug    TEXT NOT NULL DEFAULT '',
      task_label   TEXT NOT NULL DEFAULT '',
      prompt       TEXT NOT NULL DEFAULT '',
      ranked_json  TEXT NOT NULL DEFAULT '[]',
      picked_model_row_id INTEGER,
      picked_at    TEXT
    );

    -- Every call made through the router: full prompt, full answer, cost, timing.
    CREATE TABLE IF NOT EXISTS usage_events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      ts               TEXT NOT NULL DEFAULT (datetime('now')),
      provider_id      INTEGER,
      provider_slug    TEXT NOT NULL DEFAULT '',
      provider_name    TEXT NOT NULL DEFAULT '',
      model_row_id     INTEGER,
      model_id         TEXT NOT NULL DEFAULT '',
      model_label      TEXT NOT NULL DEFAULT '',
      task_slug        TEXT NOT NULL DEFAULT '',
      task_label       TEXT NOT NULL DEFAULT '',
      source           TEXT NOT NULL DEFAULT 'playground',
      system_prompt    TEXT NOT NULL DEFAULT '',
      prompt           TEXT NOT NULL DEFAULT '',
      response         TEXT NOT NULL DEFAULT '',
      input_tokens     INTEGER NOT NULL DEFAULT 0,
      output_tokens    INTEGER NOT NULL DEFAULT 0,
      total_tokens     INTEGER NOT NULL DEFAULT 0,
      cached_tokens    INTEGER NOT NULL DEFAULT 0,
      reasoning_tokens INTEGER NOT NULL DEFAULT 0,
      context_window   INTEGER NOT NULL DEFAULT 0,
      cost_usd         REAL NOT NULL DEFAULT 0,
      input_cost_usd   REAL NOT NULL DEFAULT 0,
      output_cost_usd  REAL NOT NULL DEFAULT 0,
      latency_ms       INTEGER NOT NULL DEFAULT 0,
      tokens_per_sec   REAL NOT NULL DEFAULT 0,
      estimated        INTEGER NOT NULL DEFAULT 0,
      ok               INTEGER NOT NULL DEFAULT 1,
      error            TEXT NOT NULL DEFAULT '',
      meta_json        TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider_id);
    CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage_events(ts);
    CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_events(model_row_id);
    CREATE INDEX IF NOT EXISTS idx_usage_provider ON usage_events(provider_id);
    CREATE INDEX IF NOT EXISTS idx_usage_task ON usage_events(task_slug);
  `);
}

function seed(d: Database.Database) {
  const already = d
    .prepare("SELECT value FROM settings WHERE key = 'seeded_v1'")
    .get() as { value: string } | undefined;
  if (already) return;

  const insProvider = d.prepare(`
    INSERT OR IGNORE INTO providers
      (slug, name, kind, base_url, chat_path, models_path, auth_type, auth_header, auth_query, headers_json, meta_json, enabled)
    VALUES (@slug, @name, @kind, @baseUrl, @chatPath, @modelsPath, @authType, @authHeader, @authQuery, @headers, @meta, 1)
  `);
  const insModel = d.prepare(`
    INSERT OR IGNORE INTO models
      (provider_id, model_id, label, quality, speed, cheapness, context_window, max_output,
       input_cost, output_cost, skills_json, features_json, tags_json, notes, enabled)
    VALUES (@providerId, @modelId, @label, @quality, @speed, @cheapness, @contextWindow, @maxOutput,
       @inputCost, @outputCost, @skills, @features, @tags, @notes, 1)
  `);
  const insTask = d.prepare(`
    INSERT OR IGNORE INTO tasks (slug, label, description, weights_json, requires_json, builtin)
    VALUES (@slug, @label, @description, @weights, @requires, 1)
  `);

  d.transaction(() => {
    for (const p of seedProviders) {
      insProvider.run({
        slug: p.slug,
        name: p.name,
        kind: p.kind,
        baseUrl: p.baseUrl,
        chatPath: p.chatPath,
        modelsPath: p.modelsPath,
        authType: p.authType,
        authHeader: p.authHeaderName ?? "Authorization",
        authQuery: p.authQueryName ?? "",
        headers: JSON.stringify(p.headers ?? {}),
        meta: JSON.stringify(p.meta ?? {}),
      });
      const row = d
        .prepare("SELECT id FROM providers WHERE slug = ?")
        .get(p.slug) as { id: number } | undefined;
      if (!row) continue;
      for (const m of p.models ?? []) {
        insModel.run({
          providerId: row.id,
          modelId: m.modelId,
          label: m.label ?? m.modelId,
          quality: m.quality ?? 60,
          speed: m.speed ?? 60,
          cheapness: m.cheapness ?? 60,
          contextWindow: m.contextWindow ?? 0,
          maxOutput: m.maxOutput ?? 0,
          inputCost: m.inputCost ?? 0,
          outputCost: m.outputCost ?? 0,
          skills: JSON.stringify(m.skills ?? {}),
          features: JSON.stringify(m.features ?? {}),
          tags: JSON.stringify(m.tags ?? []),
          notes: m.notes ?? "",
        });
      }
    }
    for (const t of seedTasks) {
      insTask.run({
        slug: t.slug,
        label: t.label,
        description: t.description,
        weights: JSON.stringify(t.weights),
        requires: JSON.stringify(t.requires ?? {}),
      });
    }
    d.prepare(
      "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('seeded_v1','1',datetime('now'))",
    ).run();
  })();
}

export function getSetting(key: string, fallback = ""): string {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?,?,datetime('now')) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
    )
    .run(key, value);
}
