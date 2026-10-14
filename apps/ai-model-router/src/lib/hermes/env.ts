import fs from "node:fs";
import path from "node:path";

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

export function envValues(envPath: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readEnvFile(envPath)) {
    if (line.key && !line.commented && line.value !== null) out[line.key] = line.value;
  }
  return out;
}

export function hasAnyEnvKey(envPath: string, names: string[]): boolean {
  const values = envValues(envPath);
  return names.some((n) => (values[n] ?? "").length > 0);
}

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
  }
}
