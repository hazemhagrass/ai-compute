import type DatabaseType from "better-sqlite3";

import { getSetting, setSetting } from "./db";

const LOG_TABLE = "usage_events";

export const RETENTION_DEFAULTS = {
  maxAgeDays: 30,
  maxRows: 10_000,
} as const;

export const RECOMMENDATION_RETENTION_DEFAULTS = {
  maxAgeDays: 30,
  maxRows: 1_000,
} as const;

export const AUTO_RETENTION_INTERVAL_MS = 60 * 60 * 1000;

const LAST_RUN_KEY = "retention:last_run";

const MARKERS = {
  apiKey: "[redacted:api-key]",
  token: "[redacted:token]",
  email: "[redacted:email]",
  card: "[redacted:card]",
  secret: "[redacted:secret]",
} as const;

const API_KEY_RE = /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}|\bxox[baprs]-[A-Za-z0-9-]{10,}/g;

const BEARER_RE = /\b(Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{8,})/gi;

function looksLikeToken(s: string): boolean {
  return s.length >= 20 || /\d/.test(s) || /[._~+/=-]/.test(s);
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const CARD_RE = /\b(?:\d[ -]?){12,18}\d\b/g;

const HEX_BLOB_RE = /\b[0-9a-fA-F]{32,}\b/g;

const BASE64_BLOB_RE = /\b[A-Za-z0-9+/]{32,}={0,2}/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function looksRandom(s: string): boolean {
  const digits = (s.match(/\d/g) ?? []).length;
  return digits >= 3 && /[a-z]/.test(s) && /[A-Z]/.test(s);
}

export function redactPrompt(text: string): string {
  if (typeof text !== "string" || text.length === 0) return "";

  let out = text;
  out = out.replace(API_KEY_RE, MARKERS.apiKey);
  out = out.replace(BEARER_RE, (m, scheme: string, token: string) =>
    looksLikeToken(token) ? `${scheme} ${MARKERS.token}` : m,
  );
  out = out.replace(EMAIL_RE, MARKERS.email);
  out = out.replace(CARD_RE, (m) => {
    const digits = m.replace(/[^0-9]/g, "");
    if (digits.length < 13 || digits.length > 19) return m;
    return luhnValid(digits) ? MARKERS.card : m;
  });
  out = out.replace(HEX_BLOB_RE, MARKERS.secret);
  out = out.replace(BASE64_BLOB_RE, (m) => (looksRandom(m) ? MARKERS.secret : m));

  return out;
}

export function truncateForLog(text: string, maxChars = 2000): string {
  if (typeof text !== "string" || text.length === 0) return "";
  const budget = Math.max(0, Math.floor(maxChars));
  if (text.length <= budget) return text;

  const head = Math.ceil(budget * 0.7);
  const tail = budget - head;
  const dropped = text.length - budget;
  const marker = `\n...[truncated:${dropped} chars]...\n`;

  return text.slice(0, head) + marker + (tail > 0 ? text.slice(text.length - tail) : "");
}

export interface RetentionOptions {
  maxAgeDays?: number;
  maxRows?: number;
}

export interface RetentionResult {
  deletedByAge: number;
  deletedByCount: number;
  deleted: number;
}

export function applyRetention(
  db: DatabaseType.Database,
  options: RetentionOptions = RETENTION_DEFAULTS,
): RetentionResult {
  const { maxAgeDays, maxRows } = options;
  let deletedByAge = 0;
  let deletedByCount = 0;

  if (typeof maxAgeDays === "number" && Number.isFinite(maxAgeDays) && maxAgeDays >= 0) {
    deletedByAge = db
      .prepare(`DELETE FROM ${LOG_TABLE} WHERE ts < datetime('now', ?)`)
      .run(`-${maxAgeDays} days`).changes;
  }

  if (typeof maxRows === "number" && Number.isFinite(maxRows) && maxRows >= 0) {
    deletedByCount = db
      .prepare(
        `DELETE FROM ${LOG_TABLE} WHERE id IN (
           SELECT id FROM ${LOG_TABLE} ORDER BY ts DESC, id DESC LIMIT -1 OFFSET ?
         )`,
      )
      .run(Math.floor(maxRows)).changes;
  }

  return { deletedByAge, deletedByCount, deleted: deletedByAge + deletedByCount };
}

export interface RecommendationPruneResult {
  deletedByAge: number;
  deletedByCount: number;
  deleted: number;
}

export function pruneRecommendations(
  db: DatabaseType.Database,
  options: RetentionOptions = RECOMMENDATION_RETENTION_DEFAULTS,
): RecommendationPruneResult {
  const { maxAgeDays, maxRows } = options;
  let deletedByAge = 0;
  let deletedByCount = 0;

  if (typeof maxAgeDays === "number" && Number.isFinite(maxAgeDays) && maxAgeDays >= 0) {
    deletedByAge = db
      .prepare(`DELETE FROM recommendations WHERE ts < datetime('now', ?)`)
      .run(`-${maxAgeDays} days`).changes;
  }

  if (typeof maxRows === "number" && Number.isFinite(maxRows) && maxRows >= 0) {
    deletedByCount = db
      .prepare(
        `DELETE FROM recommendations WHERE id IN (
           SELECT id FROM recommendations ORDER BY ts DESC, id DESC LIMIT -1 OFFSET ?
         )`,
      )
      .run(Math.floor(maxRows)).changes;
  }

  return { deletedByAge, deletedByCount, deleted: deletedByAge + deletedByCount };
}

export function retentionPolicy(): {
  usage: RetentionOptions;
  recommendations: RetentionOptions;
} {
  const num = (key: string, fallback: number): number => {
    const raw = getSetting(key, "");
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };

  return {
    usage: {
      maxAgeDays: num("retention:max_age_days", RETENTION_DEFAULTS.maxAgeDays),
      maxRows: num("retention:max_rows", RETENTION_DEFAULTS.maxRows),
    },
    recommendations: {
      maxAgeDays: num(
        "retention:recommendation_max_age_days",
        RECOMMENDATION_RETENTION_DEFAULTS.maxAgeDays,
      ),
      maxRows: num("retention:recommendation_max_rows", RECOMMENDATION_RETENTION_DEFAULTS.maxRows),
    },
  };
}

export function setRetentionPolicy(patch: {
  usageMaxAgeDays?: number;
  usageMaxRows?: number;
  recommendationMaxAgeDays?: number;
  recommendationMaxRows?: number;
}): void {
  if (patch.usageMaxAgeDays !== undefined) {
    setSetting("retention:max_age_days", String(Math.floor(patch.usageMaxAgeDays)));
  }
  if (patch.usageMaxRows !== undefined) {
    setSetting("retention:max_rows", String(Math.floor(patch.usageMaxRows)));
  }
  if (patch.recommendationMaxAgeDays !== undefined) {
    setSetting(
      "retention:recommendation_max_age_days",
      String(Math.floor(patch.recommendationMaxAgeDays)),
    );
  }
  if (patch.recommendationMaxRows !== undefined) {
    setSetting("retention:recommendation_max_rows", String(Math.floor(patch.recommendationMaxRows)));
  }
}

export interface AutoRetentionResult {
  ran: boolean;
  lastRunAt: string | null;
  usage: RetentionResult | null;
  recommendations: RecommendationPruneResult | null;
}

export function maybeApplyRetention(
  db: DatabaseType.Database,
  now: Date = new Date(),
  intervalMs: number = AUTO_RETENTION_INTERVAL_MS,
): AutoRetentionResult {
  const lastRaw = getSetting(LAST_RUN_KEY, "");
  const lastMs = lastRaw ? Date.parse(lastRaw) : Number.NaN;

  if (Number.isFinite(lastMs) && now.getTime() - lastMs < intervalMs) {
    return { ran: false, lastRunAt: lastRaw, usage: null, recommendations: null };
  }

  const policy = retentionPolicy();
  const usage = applyRetention(db, policy.usage);
  const recommendations = pruneRecommendations(db, policy.recommendations);

  setSetting(LAST_RUN_KEY, now.toISOString());

  return { ran: true, lastRunAt: now.toISOString(), usage, recommendations };
}
