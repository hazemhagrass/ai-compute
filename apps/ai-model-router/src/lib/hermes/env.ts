import fs from "node:fs";
import path from "node:path";

/**
 * Minimal, format-preserving .env editor.
 *
 * Hermes's own .env files are hand-maintained with comment blocks explaining
 * where to get each key (see `~/.hermes/.env`). A naive
 * `dotenv.parse -> JSON.stringify` round-trip would destroy every comment and
 * reorder every line. This keeps the file's exact line list and only
 * rewrites (or appends) the one line that changed.
 */
export interface EnvLine {
  raw: string;
  key: string | null;
  value: string | null;
  commented: boolean;
}

function parseLine(raw: string): EnvLine {
  const m = /^(\s*#\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(raw);
  if (!m) return { raw, key: null, value: null, commented: false };
  const [, hash, key, rest] = m;
  return { raw, key, value: stripQuotes(rest), commented: !!hash };
}

function stripQuotes(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function quoteIfNeeded(v: string): string {
  return /[\s#"']/.test(v) ? JSON.stringify(v) : v;
}

export function readEnvFile(envPath: string): EnvLine[] {
  if (!fs.existsSync(envPath)) return [];
  return fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map(parseLine);
}

/** Active (non-commented) KEY -> value map, last occurrence wins (matches shell `source` semantics). */
export function envValues(envPath: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readEnvFile(envPath)) {
    if (line.key && !line.commented && line.value !== null) out[line.key] = line.value;
  }
  return out;
}

/** True if ANY of the candidate env var names has a non-empty active value. */
export function hasAnyEnvKey(envPath: string, names: string[]): boolean {
  const values = envValues(envPath);
  return names.some((n) => (values[n] ?? "").length > 0);
}

/**
 * Set (or clear) a single env var, preserving every other line untouched.
 *  - If an active `KEY=...` line exists, its value is replaced in place.
 *  - Else if a commented `# KEY=...` line exists, it is uncommented and set
 *    (this is exactly the pattern in Hermes's own .env: keys ship commented
 *    out with a doc comment above, ready to be filled in).
 *  - Else the line is appended at the end of the file.
 *  - `value === null` deletes the line entirely (clears the credential).
 */
export function setEnvValue(envPath: string, key: string, value: string | null): void {
  const lines = readEnvFile(envPath);
  const activeIdx = lines.findIndex((l) => l.key === key && !l.commented);
  const commentedIdx = lines.findIndex((l) => l.key === key && l.commented);

  if (value === null) {
    const idx = activeIdx >= 0 ? activeIdx : -1;
    if (idx >= 0) lines.splice(idx, 1);
    writeLines(envPath, lines);
    return;
  }

  const formatted = `${key}=${quoteIfNeeded(value)}`;
  if (activeIdx >= 0) {
    lines[activeIdx] = { raw: formatted, key, value, commented: false };
  } else if (commentedIdx >= 0) {
    lines[commentedIdx] = { raw: formatted, key, value, commented: false };
  } else {
    lines.push({ raw: formatted, key, value, commented: false });
  }
  writeLines(envPath, lines);
}

function writeLines(envPath: string, lines: EnvLine[]): void {
  const content = lines.map((l) => l.raw).join("\n");
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, content.endsWith("\n") ? content : content + "\n", { mode: 0o600 });
  try {
    fs.chmodSync(envPath, 0o600);
  } catch {
    /* best effort on non-posix */
  }
}
