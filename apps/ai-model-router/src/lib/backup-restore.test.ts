import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createBackup } from "./backup";
import { restoreBackup, RestoreError } from "./restore";
import { decryptWith, deriveKey, encryptWith } from "./rotate";

const ROOT = mkdtempSync(join(tmpdir(), "amr-backup-test-"));

const SECRET = "backup-test-master-secret-000000000000";

interface Fixture {
  dir: string;
  dbPath: string;
  secretPath: string;
  backupDir: string;
}

function makeFixture(name: string, secret: string | null = SECRET): Fixture {
  const dir = join(ROOT, name);
  const backupDir = join(ROOT, `${name}-backup`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  const dbPath = join(dir, "router.db");
  const secretPath = join(dir, ".secret");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      api_key_enc TEXT NOT NULL DEFAULT ''
    );
  `);
  db.close();
  if (secret !== null) writeFileSync(secretPath, secret, { mode: 0o600 });
  return { dir, dbPath, secretPath, backupDir };
}

function seedProvider(dbPath: string, slug: string, plain: string, secret = SECRET): void {
  const enc = plain ? encryptWith(deriveKey(secret), plain) : "";
  const db = new Database(dbPath);
  try {
    db.prepare("INSERT INTO providers (slug, name, api_key_enc) VALUES (?,?,?)").run(
      slug,
      slug,
      enc,
    );
  } finally {
    db.close();
  }
}

function keysIn(dbPath: string): Array<{ slug: string; v: string }> {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.prepare("SELECT slug, api_key_enc AS v FROM providers ORDER BY slug").all() as Array<{
      slug: string;
      v: string;
    }>;
  } finally {
    db.close();
  }
}

beforeEach(() => {
  delete process.env.AMR_SECRET;
});

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("createBackup", () => {
  it("produces a restorable snapshot: live rows plus the master key", async () => {
    const fx = makeFixture("snap");
    seedProvider(fx.dbPath, "with-key", "sk-live-one");
    seedProvider(fx.dbPath, "without-key", "");

    const live = new Database(fx.dbPath);
    live.pragma("journal_mode = WAL");
    live.prepare("INSERT INTO providers (slug, name) VALUES ('late-writer','late-writer')").run();

    const result = await createBackup(fx.backupDir, { srcDbPath: fx.dbPath });
    live.close();

    expect(result.dbFile).toBe(join(fx.backupDir, "router.db"));
    expect(result.secretFile).toBe(join(fx.backupDir, ".secret"));
    expect(existsSync(result.dbFile)).toBe(true);
    expect(result.providers).toBe(3);
    expect(result.storedKeys).toBe(1);

    const rows = keysIn(result.dbFile);
    expect(rows.map((r) => r.slug)).toEqual(["late-writer", "with-key", "without-key"]);
    const keyed = rows.find((r) => r.slug === "with-key");
    expect(decryptWith(deriveKey(SECRET), keyed?.v ?? "")).toBe("sk-live-one");
    expect(readFileSync(result.secretFile ?? "", "utf8")).toBe(SECRET);
  });

  it("reports a missing secret file instead of inventing one", async () => {
    const fx = makeFixture("no-secret", null);
    seedProvider(fx.dbPath, "p", "sk-x");

    const result = await createBackup(fx.backupDir, { srcDbPath: fx.dbPath });

    expect(result.secretFile).toBeNull();
    expect(existsSync(join(fx.backupDir, ".secret"))).toBe(false);
  });

  it("refuses when the source database does not exist", async () => {
    const fx = makeFixture("missing-src");
    await expect(
      createBackup(fx.backupDir, { srcDbPath: join(fx.dir, "nope.db") }),
    ).rejects.toThrow(/not found/);
  });
});

describe("restoreBackup", () => {
  it("round-trips data: backup, destroy, restore, keys still decrypt", async () => {
    const fx = makeFixture("roundtrip");
    seedProvider(fx.dbPath, "rt-a", "sk-roundtrip-one");
    seedProvider(fx.dbPath, "rt-b", "sk-roundtrip-two");
    const backup = await createBackup(fx.backupDir, { srcDbPath: fx.dbPath });

    seedProvider(fx.dbPath, "rt-drifted", "sk-drifted");
    const result = restoreBackup(fx.backupDir, {
      currentSecret: SECRET,
      destDbPath: fx.dbPath,
    });

    expect(result.dryRun).toBe(false);
    expect(result.unreadableKeys).toBe(0);
    expect(result.safetyBackup).not.toBeNull();
    expect(existsSync(result.safetyBackup ?? "")).toBe(true);

    const rows = keysIn(fx.dbPath);
    expect(rows.map((r) => r.slug)).toEqual(["rt-a", "rt-b"]);
    for (const [slug, plain] of [
      ["rt-a", "sk-roundtrip-one"],
      ["rt-b", "sk-roundtrip-two"],
    ] as const) {
      const row = rows.find((r) => r.slug === slug);
      expect(decryptWith(deriveKey(SECRET), row?.v ?? "")).toBe(plain);
    }

    expect(keysIn(result.safetyBackup ?? "").map((r) => r.slug)).toContain("rt-drifted");
    expect(backup.dbFile).toBe(join(fx.backupDir, "router.db"));
  });

  it("fails cleanly with a wrong key: refuses and touches nothing", async () => {
    const fx = makeFixture("wrong-key");
    seedProvider(fx.dbPath, "wk-a", "sk-wrong-key-test");
    const before = keysIn(fx.dbPath);
    await createBackup(fx.backupDir, { srcDbPath: fx.dbPath });

    const other = "a-different-master-secret-1111111111";
    expect(() =>
      restoreBackup(fx.backupDir, { currentSecret: other, destDbPath: fx.dbPath }),
    ).toThrow(RestoreError);
    expect(() =>
      restoreBackup(fx.backupDir, { currentSecret: other, destDbPath: fx.dbPath }),
    ).toThrow(/do not decrypt/);

    expect(keysIn(fx.dbPath)).toEqual(before);
    expect(readFileSync(fx.secretPath, "utf8")).toBe(SECRET);
  });

  it("rekeys the snapshot onto the current key when asked, recovering what decrypts", async () => {
    const fx = makeFixture("rekey");
    seedProvider(fx.dbPath, "rk-ok", "sk-rekey-ok");
    seedProvider(fx.dbPath, "rk-lost", "sk-rekey-lost", "third-master-secret-2222222222");
    await createBackup(fx.backupDir, { srcDbPath: fx.dbPath });

    const empty = makeFixture("rekey-target");
    const result = restoreBackup(fx.backupDir, {
      currentSecret: SECRET,
      destDbPath: empty.dbPath,
      rekey: true,
    });

    expect(result.unreadableKeys).toBe(1);
    const rows = keysIn(empty.dbPath);
    expect(rows.map((r) => r.slug)).toEqual(["rk-lost", "rk-ok"]);
    const ok = rows.find((r) => r.slug === "rk-ok");
    expect(decryptWith(deriveKey(SECRET), ok?.v ?? "")).toBe("sk-rekey-ok");

    const snapRow = keysIn(join(fx.backupDir, "router.db")).find((r) => r.slug === "rk-lost");
    expect(decryptWith(deriveKey("third-master-secret-2222222222"), snapRow?.v ?? "")).toBe(
      "sk-rekey-lost",
    );
  });

  it("still refuses with rekey when nothing at all decrypts", async () => {
    const fx = makeFixture("all-wrong");
    seedProvider(fx.dbPath, "aw-a", "sk-original");
    await createBackup(fx.backupDir, { srcDbPath: fx.dbPath });

    const empty = makeFixture("all-wrong-target");
    const result = restoreBackup(fx.backupDir, {
      currentSecret: "yet-another-master-secret-333333",
      destDbPath: empty.dbPath,
      rekey: true,
    });
    expect(result.unreadableKeys).toBe(1);
  });

  it("rejects a directory with no router.db and a snapshot with no providers table", async () => {
    const fx = makeFixture("validate");
    expect(() =>
      restoreBackup(join(fx.dir, "empty-dir"), { currentSecret: SECRET, destDbPath: fx.dbPath }),
    ).toThrow(/no router\.db/);

    const bogusDir = join(ROOT, "bogus-backup");
    mkdirSync(bogusDir, { recursive: true });
    const bogus = new Database(join(bogusDir, "router.db"));
    bogus.exec("CREATE TABLE something_else (id INTEGER)");
    bogus.close();
    expect(() =>
      restoreBackup(bogusDir, { currentSecret: SECRET, destDbPath: fx.dbPath }),
    ).toThrow(/providers/);
  });

  it("dry run validates without swapping anything", async () => {
    const fx = makeFixture("dry");
    seedProvider(fx.dbPath, "dry-a", "sk-dry");
    await createBackup(fx.backupDir, { srcDbPath: fx.dbPath });
    const before = keysIn(fx.dbPath);

    const result = restoreBackup(fx.backupDir, {
      currentSecret: SECRET,
      destDbPath: fx.dbPath,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.safetyBackup).toBeNull();
    expect(keysIn(fx.dbPath)).toEqual(before);
  });
});
