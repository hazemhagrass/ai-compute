export type ExportRow = Record<string, unknown>;

export interface ExportColumn {
  key: string;
  header?: string;
}

export type ColumnSpec = string | ExportColumn;

export type ExportFormat = "csv" | "jsonl";

export interface StreamExportOptions {
  columns?: readonly ColumnSpec[];
  chunkRows?: number;
}

const CRLF = "\r\n";

export const USAGE_EXPORT_COLUMNS: readonly ExportColumn[] = Object.freeze([
  { key: "id", header: "id" },
  { key: "ts", header: "timestamp" },
  { key: "providerSlug", header: "provider_slug" },
  { key: "providerName", header: "provider_name" },
  { key: "modelId", header: "model_id" },
  { key: "modelLabel", header: "model_label" },
  { key: "taskSlug", header: "task_slug" },
  { key: "taskLabel", header: "task_label" },
  { key: "source", header: "source" },
  { key: "prompt", header: "prompt" },
  { key: "response", header: "response" },
  { key: "inputTokens", header: "input_tokens" },
  { key: "outputTokens", header: "output_tokens" },
  { key: "totalTokens", header: "total_tokens" },
  { key: "cachedTokens", header: "cached_tokens" },
  { key: "reasoningTokens", header: "reasoning_tokens" },
  { key: "contextWindow", header: "context_window" },
  { key: "costUsd", header: "cost_usd" },
  { key: "inputCostUsd", header: "input_cost_usd" },
  { key: "outputCostUsd", header: "output_cost_usd" },
  { key: "latencyMs", header: "latency_ms" },
  { key: "tokensPerSec", header: "tokens_per_sec" },
  { key: "estimated", header: "estimated" },
  { key: "ok", header: "ok" },
  { key: "error", header: "error" },
]);

function normalizeColumns(columns: readonly ColumnSpec[]): ExportColumn[] {
  return columns.map((c) => (typeof c === "string" ? { key: c, header: c } : c));
}

function inferColumns(rows: readonly ExportRow[]): ExportColumn[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys.map((k) => ({ key: k, header: k }));
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function neutralizeFormula(field: string): string {
  if (field.length === 0) return field;
  return FORMULA_PREFIXES.has(field[0]) ? `'${field}` : field;
}

export function escapeCsvField(value: unknown): string {
  const safe = neutralizeFormula(formatValue(value));
  const mustQuote =
    safe.includes(",") ||
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r") ||
    safe.startsWith("'");
  return mustQuote ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function csvLine(cells: readonly string[]): string {
  return cells.join(",") + CRLF;
}

export function csvHeaderLine(columns: readonly ColumnSpec[]): string {
  return csvLine(normalizeColumns(columns).map((c) => escapeCsvField(c.header ?? c.key)));
}

export function csvRowLine(row: ExportRow, columns: readonly ColumnSpec[]): string {
  return csvLine(normalizeColumns(columns).map((c) => escapeCsvField(row[c.key])));
}

export function toCsv(
  rows: readonly ExportRow[],
  columns?: readonly ColumnSpec[],
): string {
  const cols = normalizeColumns(columns ?? inferColumns(rows));
  let out = csvHeaderLine(cols);
  for (const row of rows) out += csvRowLine(row, cols);
  return out;
}

export function jsonlLine(row: ExportRow, columns?: readonly ColumnSpec[]): string {
  if (!columns) return JSON.stringify(row) + "\n";
  const projected: ExportRow = {};
  for (const c of normalizeColumns(columns)) {
    projected[c.key] = row[c.key] === undefined ? null : row[c.key];
  }
  return JSON.stringify(projected) + "\n";
}

export function toJsonl(
  rows: readonly ExportRow[],
  columns?: readonly ColumnSpec[],
): string {
  let out = "";
  for (const row of rows) out += jsonlLine(row, columns);
  return out;
}

export function contentTypeFor(format: ExportFormat): string {
  return format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson";
}

export async function* streamExport(
  rows: Iterable<ExportRow> | AsyncIterable<ExportRow>,
  format: ExportFormat = "csv",
  options: StreamExportOptions = {},
): AsyncGenerator<string, void, undefined> {
  const chunkRows = Math.max(1, Math.trunc(options.chunkRows ?? 200));
  const cols = options.columns ? normalizeColumns(options.columns) : undefined;

  if (format === "csv") {
    if (!cols) {
      throw new Error("streamExport(csv) requires options.columns for a stable header");
    }
    yield csvHeaderLine(cols);
  }

  let buffer = "";
  let buffered = 0;
  for await (const row of rows as AsyncIterable<ExportRow>) {
    buffer += format === "csv" ? csvRowLine(row, cols!) : jsonlLine(row, cols);
    buffered++;
    if (buffered >= chunkRows) {
      yield buffer;
      buffer = "";
      buffered = 0;
    }
  }
  if (buffer.length > 0) yield buffer;
}

export async function collectStream(
  chunks: AsyncIterable<string>,
): Promise<string> {
  let out = "";
  for await (const chunk of chunks) out += chunk;
  return out;
}
