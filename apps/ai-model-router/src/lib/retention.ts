import type DatabaseType from "better-sqlite3";

/**
 * Privacy-preserving log retention.
 *
 * Prompts and completions are user data: they routinely carry API keys pasted
 * for debugging, customer emails, and payment details. We keep a trimmed,
 * redacted copy because some log is needed to debug a bad route, and we expire
 * it because an indefinite copy is a breach waiting to happen.
 */

/** Table holding one row per routed call. Kept as a constant so the pruning
 * SQL below can stay a plain string literal (no user-controlled identifiers). */
const LOG_TABLE = "usage_events";

/**
 * 30 days matches the window in which a user can still plausibly ask "why did
 * it pick that model for my Tuesday request"; older rows only ever answer
 * questions nobody asks. 10k rows caps the file at a few tens of MB even when
 * a load test floods the router inside that window, so a burst cannot fill the
 * disk before the age rule gets a chance to run.
 */
export const RETENTION_DEFAULTS = {
  maxAgeDays: 30,
  maxRows: 10_000,
} as const;

/* --------------------------------------------------------------- redaction */

const MARKERS = {
  apiKey: "[redacted:api-key]",
  token: "[redacted:token]",
  email: "[redacted:email]",
  card: "[redacted:card]",
  secret: "[redacted:secret]",
} as const;

/** Vendor-prefixed keys. These prefixes are unambiguous, so no heuristics. */
const API_KEY_RE = /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}|\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}|\bxox[baprs]-[A-Za-z0-9-]{10,}/g;

/** Authorization headers pasted into a prompt while debugging a 401. */
const BEARER_RE = /\b(Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{8,})/gi;

/** "bearer of bad news" is prose, not a credential. Only redact when the
 * following word actually looks like a token. */
function looksLikeToken(s: string): boolean {
  return s.length >= 20 || /\d/.test(s) || /[._~+/=-]/.test(s);
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** 13-19 digits, optionally grouped. Luhn-checked before redacting so that
 * order numbers and timestamps in ordinary prose survive untouched. */
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

/**
 * A long opaque run is only treated as a secret when it also looks random:
 * mixed case plus several digits. Without that guard a long camelCase
 * identifier in a pasted code sample would be destroyed, which makes the log
 * useless for the exact debugging it exists to support.
 */
function looksRandom(s: string): boolean {
  const digits = (s.match(/\d/g) ?? []).length;
  return digits >= 3 && /[a-z]/.test(s) && /[A-Z]/.test(s);
}

/**
 * Strip obvious secrets and personal data before anything is written to the
 * log table. Best effort by design: it must never throw and never rewrite
 * ordinary prose or code, so a miss is preferred over a mangled log line.
 */
export function redactPrompt(text: string): string {
  if (typeof text !== "string" || text.length === 0) return "";

  let out = text;
  out = out.replace(API_KEY_RE, MARKERS.apiKey);
  // Keep the scheme word so the log still shows what kind of auth was sent.
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

/* -------------------------------------------------------------- truncation */

/**
 * Keep the head and tail of a long value and drop the middle, which is where
 * the least diagnostic information lives: the opening instructions and the
 * final answer explain a bad route, the 40kB of pasted context in between
 * does not. `maxChars` counts retained original characters; the marker is
 * added on top so the dropped count is always readable.
 */
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

/* --------------------------------------------------------------- retention */

export interface RetentionOptions {
  /** Rows older than this are deleted. Omit or pass a negative value to skip. */
  maxAgeDays?: number;
  /** Keep only the newest N rows. Omit or pass a negative value to skip. */
  maxRows?: number;
}

export interface RetentionResult {
  deletedByAge: number;
  deletedByCount: number;
  /** Total rows removed by this run. */
  deleted: number;
}

/**
 * Enforce both retention rules. Each rule is one SQL statement rather than a
 * fetch-then-delete loop, so cost stays flat as the table grows.
 */
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
    // LIMIT -1 OFFSET n selects everything past the newest n rows, so the
    // keep-set is expressed once and the delete stays a single statement.
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
