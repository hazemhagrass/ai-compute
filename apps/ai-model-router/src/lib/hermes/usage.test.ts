import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let dir: string;
let origHome: string | undefined;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "amr-usage-test-"));
  origHome = process.env.HERMES_HOME;
  process.env.HERMES_HOME = dir;
  // paths.ts reads HERMES_HOME once at module-eval time; force a fresh
  // module graph so usage.ts's import of paths.ts sees THIS test's dir
  // rather than a value cached from an earlier test file/run.
  vi.resetModules();
});

afterEach(() => {
  if (origHome === undefined) delete process.env.HERMES_HOME;
  else process.env.HERMES_HOME = origHome;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function readProfileUsage(profileId: string) {
  const mod = await import("./usage");
  return mod.readProfileUsage(profileId);
}

function seedStateDb(rows: Array<Partial<Record<string, unknown>>>) {
  const dbPath = path.join(dir, "state.db");
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE session_model_usage (
      session_id TEXT NOT NULL,
      model TEXT NOT NULL,
      billing_provider TEXT NOT NULL DEFAULT '',
      billing_base_url TEXT NOT NULL DEFAULT '',
      billing_mode TEXT NOT NULL DEFAULT '',
      task TEXT NOT NULL DEFAULT '',
      api_call_count INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      reasoning_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      actual_cost_usd REAL NOT NULL DEFAULT 0,
      cost_status TEXT,
      cost_source TEXT,
      first_seen REAL,
      last_seen REAL
    );
  `);
  const insert = db.prepare(`
    INSERT INTO session_model_usage
      (session_id, model, billing_provider, api_call_count, input_tokens, output_tokens, estimated_cost_usd, actual_cost_usd, last_seen)
    VALUES (@session_id, @model, @billing_provider, @api_call_count, @input_tokens, @output_tokens, @estimated_cost_usd, @actual_cost_usd, @last_seen)
  `);
  for (const r of rows) {
    insert.run({
      session_id: "s1",
      model: "unknown",
      billing_provider: "",
      api_call_count: 1,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: 0,
      actual_cost_usd: 0,
      last_seen: null,
      ...r,
    });
  }
  db.close();
}

describe("readProfileUsage", () => {
  it("returns the empty summary when state.db doesn't exist", async () => {
    expect(await readProfileUsage("default")).toEqual({
      rows: [],
      totalCalls: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      byProvider: [],
    });
  });

  it("returns the empty summary when the usage table doesn't exist yet", async () => {
    const db = new Database(path.join(dir, "state.db"));
    db.exec("CREATE TABLE other (x INTEGER)");
    db.close();
    expect((await readProfileUsage("default")).rows).toEqual([]);
  });

  it("aggregates rows by model and computes provider/total rollups", async () => {
    seedStateDb([
      {
        model: "claude-opus-5",
        billing_provider: "anthropic",
        api_call_count: 3,
        input_tokens: 1000,
        output_tokens: 200,
        actual_cost_usd: 0.5,
      },
      {
        model: "claude-opus-5",
        billing_provider: "anthropic",
        api_call_count: 2,
        input_tokens: 500,
        output_tokens: 100,
        actual_cost_usd: 0.25,
      },
      {
        model: "qwen3-coder:30b",
        billing_provider: "custom",
        api_call_count: 10,
        input_tokens: 5000,
        output_tokens: 1000,
        estimated_cost_usd: 0,
        actual_cost_usd: 0,
      },
    ]);

    const usage = await readProfileUsage("default");
    expect(usage.rows).toHaveLength(2);

    const opus = usage.rows.find((r) => r.model === "claude-opus-5")!;
    expect(opus.apiCallCount).toBe(5);
    expect(opus.inputTokens).toBe(1500);
    expect(opus.actualCostUsd).toBeCloseTo(0.75);

    expect(usage.totalCalls).toBe(15);
    expect(usage.totalTokens).toBe(1500 + 300 + 6000);
    expect(usage.totalCostUsd).toBeCloseTo(0.75);

    const anthropic = usage.byProvider.find((p) => p.provider === "anthropic")!;
    expect(anthropic.calls).toBe(5);
    expect(anthropic.costUsd).toBeCloseTo(0.75);

    const custom = usage.byProvider.find((p) => p.provider === "custom")!;
    expect(custom.calls).toBe(10);
    expect(custom.costUsd).toBe(0);
  });

  it("falls back to estimated_cost_usd when actual_cost_usd is 0", async () => {
    seedStateDb([
      {
        model: "some-model",
        billing_provider: "openrouter",
        estimated_cost_usd: 0.1,
        actual_cost_usd: 0,
      },
    ]);
    const usage = await readProfileUsage("default");
    expect(usage.rows[0].actualCostUsd || usage.rows[0].estimatedCostUsd).toBeCloseTo(0.1);
    expect(usage.totalCostUsd).toBeCloseTo(0.1);
  });
});
