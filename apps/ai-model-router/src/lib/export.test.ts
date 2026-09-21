import { describe, expect, it } from "vitest";

import {
  USAGE_EXPORT_COLUMNS,
  collectStream,
  contentTypeFor,
  escapeCsvField,
  formatValue,
  neutralizeFormula,
  streamExport,
  toCsv,
  toJsonl,
  type ExportRow,
} from "./export";

const CRLF = "\r\n";

/** Minimal RFC 4180 reader, used to prove the writer round-trips. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 2;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const COLUMNS = ["id", "prompt", "costUsd"];

describe("formatValue", () => {
  it("renders null and undefined as an empty cell, not the string null", () => {
    expect(formatValue(null)).toBe("");
    expect(formatValue(undefined)).toBe("");
  });

  it("renders numbers, booleans and dates predictably", () => {
    expect(formatValue(0)).toBe("0");
    expect(formatValue(1.25)).toBe("1.25");
    expect(formatValue(false)).toBe("false");
    expect(formatValue(new Date("2026-01-02T03:04:05.000Z"))).toBe(
      "2026-01-02T03:04:05.000Z",
    );
  });

  it("blanks NaN and Infinity rather than poisoning a numeric column", () => {
    expect(formatValue(Number.NaN)).toBe("");
    expect(formatValue(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("serialises objects as JSON so meta survives a CSV cell", () => {
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("escapeCsvField (RFC 4180)", () => {
  it("leaves a plain field unquoted", () => {
    expect(escapeCsvField("hello world")).toBe("hello world");
  });

  it("quotes a field containing a comma", () => {
    expect(escapeCsvField("gpt, claude")).toBe('"gpt, claude"');
  });

  it("doubles inner quotes and wraps the field", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("handles a field with a comma, a quote and a newline at once", () => {
    expect(escapeCsvField('a,b "c"\nd')).toBe('"a,b ""c""\nd"');
  });
});

describe("formula injection defence", () => {
  it.each(["=", "+", "-", "@"])(
    "neutralises a field beginning with %s",
    (prefix) => {
      const out = neutralizeFormula(`${prefix}HYPERLINK("http://evil.tld")`);
      expect(out.startsWith("'")).toBe(true);
      expect(out.slice(1).startsWith(prefix)).toBe(true);
    },
  );

  it("neutralises the classic command-execution payload", () => {
    const csv = toCsv([{ id: 1, prompt: "=cmd|'/c calc'!A1", costUsd: 0 }], COLUMNS);
    const cell = parseCsv(csv)[1][1];

    expect(cell).toBe("'=cmd|'/c calc'!A1");
    expect(cell.startsWith("=")).toBe(false);
  });

  it("neutralises leading tab and CR, which also reach the formula parser", () => {
    expect(neutralizeFormula("\t=1+1")).toBe("'\t=1+1");
    expect(neutralizeFormula("\r=1+1")).toBe("'\r=1+1");
  });

  it("leaves a safe field untouched", () => {
    expect(neutralizeFormula("summarise this")).toBe("summarise this");
    expect(neutralizeFormula("")).toBe("");
  });

  it("does not mangle a formula-looking value that is not at the start", () => {
    expect(neutralizeFormula("total =SUM(A1)")).toBe("total =SUM(A1)");
  });
});

describe("toCsv", () => {
  const rows: ExportRow[] = [
    { id: 1, prompt: "plain prompt", costUsd: 0.0012 },
    { id: 2, prompt: 'has "quotes", a comma\nand a newline', costUsd: 0.5 },
    { id: 3, prompt: null, costUsd: undefined },
  ];

  it("emits a header row in the requested column order", () => {
    expect(parseCsv(toCsv(rows, COLUMNS))[0]).toEqual(COLUMNS);
  });

  it("round-trips hostile prompts through a conforming parser", () => {
    const parsed = parseCsv(toCsv(rows, COLUMNS));

    expect(parsed).toHaveLength(4);
    expect(parsed[2][1]).toBe('has "quotes", a comma\nand a newline');
    expect(parsed.every((r) => r.length === 3)).toBe(true);
  });

  it("writes empty cells for null and undefined", () => {
    const parsed = parseCsv(toCsv(rows, COLUMNS));

    expect(parsed[3][1]).toBe("");
    expect(parsed[3][2]).toBe("");
    expect(toCsv(rows, COLUMNS)).not.toContain("null");
  });

  it("separates records with CRLF", () => {
    expect(toCsv([{ id: 1, prompt: "a", costUsd: 1 }], COLUMNS)).toBe(
      `id,prompt,costUsd${CRLF}1,a,1${CRLF}`,
    );
  });

  it("preserves unicode and emoji byte for byte", () => {
    const prompt = "naïve café 日本語 🙈🚀 Ωmega";
    const parsed = parseCsv(toCsv([{ id: 1, prompt, costUsd: 0 }], COLUMNS));

    expect(parsed[1][1]).toBe(prompt);
  });

  it("emits a header-only file for no rows", () => {
    expect(toCsv([], COLUMNS)).toBe(`id,prompt,costUsd${CRLF}`);
  });

  it("infers a stable first-seen column order when none is given", () => {
    const csv = toCsv([{ b: 1 }, { a: 2, b: 3 }]);

    expect(parseCsv(csv)[0]).toEqual(["b", "a"]);
  });

  it("keeps a column order that does not shift between exports", () => {
    const keys = USAGE_EXPORT_COLUMNS.map((c) => c.key);
    const headers = parseCsv(toCsv([], USAGE_EXPORT_COLUMNS))[0];

    expect(headers).toEqual(USAGE_EXPORT_COLUMNS.map((c) => c.header));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toBe("id");
    expect(keys[1]).toBe("ts");
  });

  it("uses a column header distinct from the property key when asked", () => {
    const csv = toCsv([{ costUsd: 1 }], [{ key: "costUsd", header: "cost_usd" }]);

    expect(parseCsv(csv)[0]).toEqual(["cost_usd"]);
  });
});

describe("toJsonl", () => {
  const rows: ExportRow[] = [
    { id: 1, prompt: "first\nline", costUsd: 0.1 },
    { id: 2, prompt: "🙈 emoji, and \"quotes\"", costUsd: null },
  ];

  it("parses line by line, one document per line", () => {
    const lines = toJsonl(rows).trimEnd().split("\n");

    expect(lines).toHaveLength(2);
    expect(lines.map((l) => JSON.parse(l))).toEqual(rows);
  });

  it("escapes embedded newlines so one record never spans two lines", () => {
    const text = toJsonl(rows);

    expect(text.split("\n").filter((l) => l.length > 0)).toHaveLength(2);
    expect(JSON.parse(text.split("\n")[0]).prompt).toBe("first\nline");
  });

  it("terminates every line, including the last", () => {
    expect(toJsonl(rows).endsWith("\n")).toBe(true);
  });

  it("projects to the stable column set, filling missing keys with null", () => {
    const parsed = JSON.parse(toJsonl([{ id: 7 }], COLUMNS).trimEnd());

    expect(Object.keys(parsed)).toEqual(COLUMNS);
    expect(parsed.prompt).toBeNull();
  });

  it("returns an empty string for no rows", () => {
    expect(toJsonl([])).toBe("");
  });

  it("preserves unicode and emoji", () => {
    const prompt = "naïve café 日本語 🙈";
    const parsed = JSON.parse(toJsonl([{ prompt }]).trimEnd());

    expect(parsed.prompt).toBe(prompt);
  });
});

describe("streamExport", () => {
  const many: ExportRow[] = Array.from({ length: 250 }, (_, i) => ({
    id: i,
    prompt: i % 3 === 0 ? `weird "${i}", line\nbreak` : `prompt ${i} 🚀`,
    costUsd: i % 7 === 0 ? null : i / 1000,
  }));

  async function* asAsync(rows: ExportRow[]): AsyncGenerator<ExportRow> {
    for (const row of rows) yield row;
  }

  it("concatenates to exactly the non-streamed CSV", async () => {
    const streamed = await collectStream(
      streamExport(many, "csv", { columns: COLUMNS, chunkRows: 17 }),
    );

    expect(streamed).toBe(toCsv(many, COLUMNS));
  });

  it("concatenates to exactly the non-streamed JSONL", async () => {
    const streamed = await collectStream(
      streamExport(many, "jsonl", { columns: COLUMNS, chunkRows: 33 }),
    );

    expect(streamed).toBe(toJsonl(many, COLUMNS));
  });

  it("yields many chunks rather than one giant string", async () => {
    const chunks: string[] = [];
    for await (const c of streamExport(many, "csv", { columns: COLUMNS, chunkRows: 25 })) {
      chunks.push(c);
    }

    // header + ceil(250 / 25) row chunks
    expect(chunks).toHaveLength(11);
    expect(chunks[0]).toBe(`id,prompt,costUsd${CRLF}`);
  });

  it("accepts an async iterable of rows, so pages can come from SQLite lazily", async () => {
    const streamed = await collectStream(
      streamExport(asAsync(many), "csv", { columns: COLUMNS, chunkRows: 64 }),
    );

    expect(streamed).toBe(toCsv(many, COLUMNS));
  });

  it("emits only the header for an empty CSV export", async () => {
    const chunks: string[] = [];
    for await (const c of streamExport([], "csv", { columns: COLUMNS })) chunks.push(c);

    expect(chunks).toEqual([`id,prompt,costUsd${CRLF}`]);
  });

  it("emits nothing for an empty JSONL export", async () => {
    expect(await collectStream(streamExport([], "jsonl"))).toBe("");
  });

  it("refuses a CSV stream without explicit columns", async () => {
    await expect(collectStream(streamExport(many, "csv"))).rejects.toThrow(
      /requires options.columns/,
    );
  });

  it("keeps the injection defence in the streamed output", async () => {
    const hostile: ExportRow[] = [{ id: 1, prompt: "=1+1", costUsd: 0 }];
    const streamed = await collectStream(
      streamExport(hostile, "csv", { columns: COLUMNS }),
    );

    expect(parseCsv(streamed)[1][1]).toBe("'=1+1");
  });
});

describe("contentTypeFor", () => {
  it("advertises the right media type per format", () => {
    expect(contentTypeFor("csv")).toBe("text/csv; charset=utf-8");
    expect(contentTypeFor("jsonl")).toBe("application/x-ndjson");
  });
});
