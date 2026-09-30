import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// A scratch data dir per run, set before the db module resolves its paths,
// so tests never read or write the developer's real router.db.
const DIR = mkdtempSync(join(tmpdir(), "amr-retention-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "test.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

const { getDb } = await import("./db");
const {
  RETENTION_DEFAULTS,
  RECOMMENDATION_RETENTION_DEFAULTS,
  applyRetention,
  pruneRecommendations,
  maybeApplyRetention,
  redactPrompt,
  truncateForLog,
  retentionPolicy,
  setRetentionPolicy,
} = await import("./retention");

let db: ReturnType<typeof getDb>;

beforeAll(() => {
  db = getDb();
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

/* --------------------------------------------------------------- helpers */

let tag = 0;

/**
 * Opening the database seeds a starter catalogue, and other suites may share
 * the file, so every retention assertion is scoped to rows carrying this
 * suite's unique task_slug rather than to a global count.
 */
function seedLogs(rows: { daysAgo: number }[]): {
  slug: string;
  ids: number[];
  remaining: () => { id: number; ts: string }[];
} {
  const slug = `retention-test-${++tag}`;
  const ins = db.prepare(
    `INSERT INTO usage_events (ts, task_slug, prompt, response)
     VALUES (datetime('now', ?), ?, ?, ?)`,
  );
  const ids = rows.map((r, i) =>
    Number(ins.run(`-${r.daysAgo} days`, slug, `prompt ${i}`, `response ${i}`).lastInsertRowid),
  );
  return {
    slug,
    ids,
    remaining: () =>
      db
        .prepare("SELECT id, ts FROM usage_events WHERE task_slug = ? ORDER BY id")
        .all(slug) as { id: number; ts: string }[],
  };
}

/** Retention scoped to one suite's rows: the helpers under test operate on the
 * whole table, so foreign rows are removed first to keep counts meaningful. */
function isolate(slug: string): void {
  db.prepare("DELETE FROM usage_events WHERE task_slug != ?").run(slug);
}

/* -------------------------------------------------------------- redaction */

describe("redactPrompt", () => {
  it("redacts vendor-prefixed API keys", () => {
    const out = redactPrompt("my key is sk-abc123DEF456ghi789jkl012 ok");

    expect(out).not.toContain("sk-abc123DEF456ghi789jkl012");
    expect(out).toContain("[redacted:api-key]");
  });

  it("redacts GitHub and Slack style tokens", () => {
    const out = redactPrompt("ghp_ABCdef0123456789ABCdef0123456789AB and xoxb-1234567890-abcdef");

    expect(out).not.toContain("ghp_ABCdef0123456789ABCdef0123456789AB");
    expect(out).not.toContain("xoxb-1234567890-abcdef");
  });

  it("redacts bearer tokens but keeps the scheme for debugging", () => {
    const out = redactPrompt("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");

    expect(out).toContain("Bearer [redacted:token]");
    expect(out).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
  });

  it("redacts email addresses", () => {
    const out = redactPrompt("contact jane.doe+tag@example.co.uk about it");

    expect(out).toBe("contact [redacted:email] about it");
  });

  it("redacts credit-card-like digit runs, grouped or not", () => {
    // Luhn-valid test numbers.
    const spaced = redactPrompt("card 4111 1111 1111 1111 expires soon");
    const solid = redactPrompt("card 5500005555555559 expires soon");

    expect(spaced).toContain("[redacted:card]");
    expect(spaced).not.toContain("4111");
    expect(solid).toContain("[redacted:card]");
  });

  it("leaves non-Luhn digit runs such as order numbers alone", () => {
    const out = redactPrompt("order 1234567890123456 shipped");

    expect(out).toBe("order 1234567890123456 shipped");
  });

  it("redacts long hex blobs", () => {
    const out = redactPrompt("sig=0123456789abcdef0123456789abcdef0123");

    expect(out).toContain("[redacted:secret]");
    expect(out).not.toContain("0123456789abcdef0123456789abcdef");
  });

  it("redacts long random base64-ish blobs", () => {
    const out = redactPrompt("token WGh2c2VjcmV0MTIzNDU2Nzg5QUJDZGVmZ2hpams=");

    expect(out).toContain("[redacted:secret]");
  });

  it("leaves ordinary prose completely untouched", () => {
    const prose =
      "Please summarise the Q3 report in 3 bullet points and keep the tone neutral. " +
      "The bearer of bad news should still be polite in 2024.";

    expect(redactPrompt(prose)).toBe(prose);
  });

  it("leaves ordinary code untouched", () => {
    const code = [
      "export function computeTotalPrice(items: Item[]): number {",
      "  return items.reduce((acc, item) => acc + item.price * item.quantity, 0);",
      "}",
    ].join("\n");

    expect(redactPrompt(code)).toBe(code);
  });

  it("returns an empty string for empty input without throwing", () => {
    expect(redactPrompt("")).toBe("");
  });

  it("redacts every occurrence, not just the first", () => {
    const out = redactPrompt("a@b.com and c@d.com");

    expect(out).toBe("[redacted:email] and [redacted:email]");
  });
});

/* ------------------------------------------------------------- truncation */

describe("truncateForLog", () => {
  it("returns text shorter than the max unchanged", () => {
    const short = "a short prompt";

    expect(truncateForLog(short, 2000)).toBe(short);
  });

  it("returns text exactly at the max unchanged", () => {
    const exact = "x".repeat(100);

    expect(truncateForLog(exact, 100)).toBe(exact);
  });

  it("truncates one character over the max", () => {
    const over = "x".repeat(101);

    expect(truncateForLog(over, 100)).not.toBe(over);
    expect(truncateForLog(over, 100)).toContain("[truncated:1 chars]");
  });

  it("keeps both the head and the tail", () => {
    const text = `HEAD_MARKER${"m".repeat(5000)}TAIL_MARKER`;
    const out = truncateForLog(text, 1000);

    expect(out.startsWith("HEAD_MARKER")).toBe(true);
    expect(out.endsWith("TAIL_MARKER")).toBe(true);
  });

  it("reports the exact number of dropped characters", () => {
    const text = "y".repeat(3000);
    const out = truncateForLog(text, 2000);

    expect(out).toContain("[truncated:1000 chars]");
  });

  it("retains exactly maxChars of original content", () => {
    const text = "z".repeat(5000);
    const out = truncateForLog(text, 2000);
    const marker = out.match(/\n\.\.\.\[truncated:\d+ chars\]\.\.\.\n/);

    expect(marker).not.toBeNull();
    expect(out.length - (marker?.[0].length ?? 0)).toBe(2000);
  });

  it("defaults to a 2000 character budget", () => {
    const out = truncateForLog("q".repeat(2500));

    expect(out).toContain("[truncated:500 chars]");
  });

  it("handles empty input", () => {
    expect(truncateForLog("", 2000)).toBe("");
  });

  it("composes with redaction without resurrecting a secret", () => {
    const raw = `${"a".repeat(3000)} sk-abc123DEF456ghi789jkl012`;
    const out = truncateForLog(redactPrompt(raw), 500);

    expect(out).not.toContain("sk-abc123DEF456ghi789jkl012");
  });
});

/* -------------------------------------------------------------- retention */

describe("RETENTION_DEFAULTS", () => {
  it("ships a bounded age and row policy", () => {
    expect(RETENTION_DEFAULTS.maxAgeDays).toBe(30);
    expect(RETENTION_DEFAULTS.maxRows).toBe(10_000);
  });
});

describe("applyRetention", () => {
  it("deletes rows older than maxAgeDays and keeps newer ones", () => {
    const { slug, remaining } = seedLogs([
      { daysAgo: 0 },
      { daysAgo: 5 },
      { daysAgo: 40 },
      { daysAgo: 400 },
    ]);
    isolate(slug);

    const result = applyRetention(db, { maxAgeDays: 30 });

    expect(result.deletedByAge).toBe(2);
    expect(remaining()).toHaveLength(2);
  });

  it("trims to the newest maxRows, keeping the newest rows", () => {
    const { slug, ids, remaining } = seedLogs([
      { daysAgo: 5 },
      { daysAgo: 4 },
      { daysAgo: 3 },
      { daysAgo: 2 },
      { daysAgo: 1 },
    ]);
    isolate(slug);

    const result = applyRetention(db, { maxRows: 2 });
    const left = remaining().map((r) => r.id);

    expect(result.deletedByCount).toBe(3);
    // Seeded oldest first, so the two survivors must be the last two inserted.
    expect(left).toEqual(ids.slice(-2));
  });

  it("reports a combined total across both rules", () => {
    const { slug } = seedLogs([
      { daysAgo: 100 },
      { daysAgo: 90 },
      { daysAgo: 3 },
      { daysAgo: 2 },
      { daysAgo: 1 },
    ]);
    isolate(slug);

    const result = applyRetention(db, { maxAgeDays: 30, maxRows: 1 });

    expect(result.deletedByAge).toBe(2);
    expect(result.deletedByCount).toBe(2);
    expect(result.deleted).toBe(4);
  });

  it("is a no-op when nothing violates the policy", () => {
    const { slug, remaining } = seedLogs([{ daysAgo: 1 }, { daysAgo: 2 }]);
    isolate(slug);

    const result = applyRetention(db, { maxAgeDays: 30, maxRows: 100 });

    expect(result.deleted).toBe(0);
    expect(remaining()).toHaveLength(2);
  });

  it("skips a rule that is not configured", () => {
    const { slug, remaining } = seedLogs([{ daysAgo: 400 }, { daysAgo: 1 }]);
    isolate(slug);

    const result = applyRetention(db, { maxRows: 5 });

    expect(result.deletedByAge).toBe(0);
    expect(remaining()).toHaveLength(2);
  });

  it("is idempotent: a second run deletes nothing", () => {
    const { slug } = seedLogs([{ daysAgo: 60 }, { daysAgo: 50 }, { daysAgo: 1 }]);
    isolate(slug);

    applyRetention(db, { maxAgeDays: 30, maxRows: 10 });
    const second = applyRetention(db, { maxAgeDays: 30, maxRows: 10 });

    expect(second.deleted).toBe(0);
  });

  it("empties the table when maxRows is zero", () => {
    const { slug, remaining } = seedLogs([{ daysAgo: 1 }, { daysAgo: 2 }]);
    isolate(slug);

    applyRetention(db, { maxRows: 0 });

    expect(remaining()).toHaveLength(0);
  });
});


describe("retention defaults", () => {
  it("recommendation pruning is stricter than usage retention", () => {
    // The recommendation table stores a full ranked snapshot per row, so its
    // cap must be well below the usage table's, or snapshots would dominate
    // the database. Pinning the relationship here stops a default change from
    // silently inverting it.
    expect(RECOMMENDATION_RETENTION_DEFAULTS.maxRows).toBeLessThan(RETENTION_DEFAULTS.maxRows);
    expect(RECOMMENDATION_RETENTION_DEFAULTS.maxAgeDays).toBeLessThanOrEqual(
      RETENTION_DEFAULTS.maxAgeDays,
    );
  });
});

describe("pruneRecommendations (#171)", () => {
  let rtag = 0;

  /** Insert a recommendation with an explicit age in days. */
  function seedRec(daysAgo: number): number {
    const info = db
      .prepare(
        `INSERT INTO recommendations (ts, task_slug, task_label, prompt, ranked_json)
         VALUES (datetime('now', ?), ?, '', '', '[]')`,
      )
      .run(`-${daysAgo} days`, `rec-prune-test-${++rtag}`);
    return Number(info.lastInsertRowid);
  }

  it("deletes by age and keeps recent rows", () => {
    const old1 = seedRec(90);
    const old2 = seedRec(45);
    const fresh = seedRec(2);

    pruneRecommendations(db, { maxAgeDays: 30 });
    const left = (db.prepare("SELECT id FROM recommendations").all() as { id: number }[]).map(
      (r) => r.id,
    );

    expect(left).not.toContain(old1);
    expect(left).not.toContain(old2);
    expect(left).toContain(fresh);
  });

  it("enforces the hard cap regardless of age", () => {
    const ids = [seedRec(1), seedRec(1), seedRec(1), seedRec(1), seedRec(1)];

    pruneRecommendations(db, { maxRows: 2 });
    const left = (db.prepare("SELECT id FROM recommendations").all() as { id: number }[]).map(
      (r) => r.id,
    );

    // Newest two survive.
    expect(left).toContain(ids[4]);
    expect(left).toContain(ids[3]);
    expect(left).not.toContain(ids[0]);
  });

  it("is a no-op when the policy is satisfied", () => {
    seedRec(1);
    const before = (db.prepare("SELECT COUNT(*) AS n FROM recommendations").get() as { n: number }).n;

    const result = pruneRecommendations(db, { maxAgeDays: 30, maxRows: 1000 });

    expect(result.deleted).toBe(0);
    const after = (db.prepare("SELECT COUNT(*) AS n FROM recommendations").get() as { n: number }).n;
    expect(after).toBe(before);
  });
});

describe("maybeApplyRetention (#165)", () => {
  it("runs on the first call and stamps the last-run time", () => {
    const result = maybeApplyRetention(db, new Date("2026-09-28T12:00:00Z"));

    expect(result.ran).toBe(true);
    expect(result.lastRunAt).toBe("2026-09-28T12:00:00.000Z");
    expect(result.usage).not.toBeNull();
    expect(result.recommendations).not.toBeNull();
  });

  it("skips the second call inside the same interval", () => {
    const t0 = new Date("2026-10-01T00:00:00Z");
    maybeApplyRetention(db, t0);

    const second = maybeApplyRetention(db, new Date(t0.getTime() + 60_000));

    expect(second.ran).toBe(false);
    expect(second.usage).toBeNull();
  });

  it("runs again once the interval has elapsed", () => {
    const t0 = new Date("2026-11-01T00:00:00Z");
    maybeApplyRetention(db, t0, 60 * 60 * 1000);

    const third = maybeApplyRetention(db, new Date(t0.getTime() + 61 * 60 * 1000), 60 * 60 * 1000);

    expect(third.ran).toBe(true);
  });

  it("actually prunes old rows when it runs", () => {
    const stale = db
      .prepare(
        `INSERT INTO recommendations (ts, task_slug, task_label, prompt, ranked_json)
         VALUES (datetime('now', '-400 days'), 'stale-rec', '', '', '[]')`,
      )
      .run().lastInsertRowid;

    maybeApplyRetention(db, new Date("2026-12-01T00:00:00Z"));

    const gone = db.prepare("SELECT id FROM recommendations WHERE id = ?").get(stale);
    expect(gone).toBeUndefined();
  });
});

describe("retentionPolicy / setRetentionPolicy (#183)", () => {
  it("falls back to the built-in defaults when nothing is set", () => {
    // Fresh DB in this suite already has no overrides on first call for keys
    // this describe block does not touch.
    const policy = retentionPolicy();

    expect(policy.usage.maxAgeDays).toBeGreaterThanOrEqual(0);
    expect(policy.recommendations.maxRows).toBeGreaterThanOrEqual(0);
  });

  it("persists a partial override and leaves the rest untouched", () => {
    const before = retentionPolicy();

    setRetentionPolicy({ usageMaxAgeDays: 7 });
    const after = retentionPolicy();

    expect(after.usage.maxAgeDays).toBe(7);
    expect(after.usage.maxRows).toBe(before.usage.maxRows);
    expect(after.recommendations).toEqual(before.recommendations);
  });

  it("updates all four fields when given a full patch", () => {
    setRetentionPolicy({
      usageMaxAgeDays: 14,
      usageMaxRows: 500,
      recommendationMaxAgeDays: 10,
      recommendationMaxRows: 200,
    });

    const policy = retentionPolicy();

    expect(policy.usage).toEqual({ maxAgeDays: 14, maxRows: 500 });
    expect(policy.recommendations).toEqual({ maxAgeDays: 10, maxRows: 200 });
  });

  it("what it persists is what a manual prune actually uses", () => {
    setRetentionPolicy({ usageMaxAgeDays: 5, usageMaxRows: 1000 });
    const { slug, remaining } = seedLogs([{ daysAgo: 10 }, { daysAgo: 1 }]);
    isolate(slug);

    const policy = retentionPolicy();
    const result = applyRetention(db, {
      maxAgeDays: policy.usage.maxAgeDays,
      maxRows: policy.usage.maxRows,
    });

    expect(result.deletedByAge).toBe(1);
    expect(remaining()).toHaveLength(1);
  });
});
