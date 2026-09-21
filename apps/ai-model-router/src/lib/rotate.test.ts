import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type Database from "better-sqlite3";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// A scratch data dir per run, set before the modules under test resolve their
// paths, so a rotation test never rewrites the developer's real router.db.
const DIR = mkdtempSync(join(tmpdir(), "amr-rotate-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "test.db");

const OLD_SECRET = "old-master-secret-0000000000000000";
const NEW_SECRET = "new-master-secret-1111111111111111";
process.env.AMR_SECRET = OLD_SECRET;

const { getDb } = await import("./db");
const rotate = await import("./rotate");
const repo = await import("./repo");

const db: Database.Database = getDb();

const oldKey = rotate.deriveKey(OLD_SECRET);

/** Insert a provider whose stored key is encrypted under `secret`. */
function seedSecret(slug: string, plain: string, secret = OLD_SECRET): number {
  const enc = plain ? rotate.encryptWith(rotate.deriveKey(secret), plain) : "";
  const info = db
    .prepare("INSERT INTO providers (slug, name, api_key_enc) VALUES (?,?,?)")
    .run(slug, slug, enc);
  return Number(info.lastInsertRowid);
}

/** Insert a row whose ciphertext no key can ever open. */
function seedCorrupt(slug: string): number {
  const info = db
    .prepare("INSERT INTO providers (slug, name, api_key_enc) VALUES (?,?,?)")
    .run(slug, slug, "v1.QUJDREVGR0hJSktM.QUJDREVGR0hJSktMTU5PUA.QUJD");
  return Number(info.lastInsertRowid);
}

function stored(id: number): string {
  const row = db.prepare("SELECT api_key_enc AS v FROM providers WHERE id = ?").get(id) as
    | { v: string }
    | undefined;
  return row?.v ?? "";
}

// Opening the database seeds a starter catalogue, so the table is never empty
// and global counts would drift. Every test starts from "the only rows holding
// a secret are the ones this test created".
beforeEach(() => {
  db.prepare("DELETE FROM providers WHERE api_key_enc != ''").run();
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe("rotateMasterKey", () => {
  it("re-encrypts every secret so it still decrypts to the original value", () => {
    const secrets = {
      a: seedSecret("rot-a", "sk-alpha-1234567890"),
      b: seedSecret("rot-b", "sk-beta-0987654321"),
      c: seedSecret("rot-c", "sk-gamma-unicode-\u00e9\u00e0-\u2713"),
    };
    const before = {
      a: stored(secrets.a),
      b: stored(secrets.b),
      c: stored(secrets.c),
    };

    const result = rotate.rotateMasterKey({ oldSecret: OLD_SECRET, newSecret: NEW_SECRET });

    const newKey = rotate.deriveKey(NEW_SECRET);
    expect(rotate.decryptWith(newKey, stored(secrets.a))).toBe("sk-alpha-1234567890");
    expect(rotate.decryptWith(newKey, stored(secrets.b))).toBe("sk-beta-0987654321");
    expect(rotate.decryptWith(newKey, stored(secrets.c))).toBe("sk-gamma-unicode-\u00e9\u00e0-\u2713");
    // The ciphertext must actually have changed, otherwise "rotated" is a lie.
    expect(stored(secrets.a)).not.toBe(before.a);
    expect(stored(secrets.b)).not.toBe(before.b);
    expect(stored(secrets.c)).not.toBe(before.c);
    expect(result.rotated).toBe(3);
    expect(result.dryRun).toBe(false);
  });

  it("rotates keys written by the app's own encrypt path", () => {
    // End-to-end guard: rotate.ts re-implements the wire format, so it has to
    // stay byte-compatible with crypto.ts or rotation destroys real data.
    const p = repo.createProvider({
      name: "Live Crypto",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-written-by-crypto-ts",
    });

    rotate.rotateMasterKey({ oldSecret: OLD_SECRET, newSecret: NEW_SECRET });

    expect(rotate.decryptWith(rotate.deriveKey(NEW_SECRET), stored(p.id))).toBe(
      "sk-written-by-crypto-ts",
    );
  });

  it("returns a usable new key when the caller does not supply one", () => {
    seedSecret("rot-gen", "sk-generated");

    const result = rotate.rotateMasterKey({ oldSecret: OLD_SECRET });

    expect(result.newSecret.length).toBeGreaterThanOrEqual(16);
    expect(result.newSecret).not.toBe(OLD_SECRET);
    expect(rotate.decryptWith(rotate.deriveKey(result.newSecret), stored(result.rows[0].id))).toBe(
      "sk-generated",
    );
  });

  it("reports which rows it touched", () => {
    const id = seedSecret("rot-rows", "sk-rows");

    const result = rotate.rotateMasterKey({ oldSecret: OLD_SECRET, newSecret: NEW_SECRET });

    expect(result.rows).toContainEqual({ table: "providers", id, column: "api_key_enc" });
  });

  it("skips empty secrets instead of crashing on them", () => {
    const empty = seedSecret("rot-empty", "");
    const keyed = seedSecret("rot-keyed", "sk-only-real-one");

    const result = rotate.rotateMasterKey({ oldSecret: OLD_SECRET, newSecret: NEW_SECRET });

    expect(result.rotated).toBe(1);
    // Every seeded provider has an empty key too, so this counts them all.
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(stored(empty)).toBe("");
    expect(rotate.decryptWith(rotate.deriveKey(NEW_SECRET), stored(keyed))).toBe(
      "sk-only-real-one",
    );
  });

  describe("dry run", () => {
    it("changes nothing in the database", () => {
      const a = seedSecret("dry-a", "sk-dry-alpha");
      const b = seedSecret("dry-b", "sk-dry-beta");
      const before = { a: stored(a), b: stored(b) };

      rotate.rotateMasterKey({ oldSecret: OLD_SECRET, newSecret: NEW_SECRET, dryRun: true });

      expect(stored(a)).toBe(before.a);
      expect(stored(b)).toBe(before.b);
      expect(rotate.decryptWith(oldKey, stored(a))).toBe("sk-dry-alpha");
      expect(rotate.decryptWith(oldKey, stored(b))).toBe("sk-dry-beta");
    });

    it("reports the counts a real run would produce", () => {
      seedSecret("dry-c", "sk-dry-gamma");
      seedSecret("dry-d", "");

      const result = rotate.rotateMasterKey({
        oldSecret: OLD_SECRET,
        newSecret: NEW_SECRET,
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.rotated).toBe(1);
      expect(result.skipped).toBeGreaterThanOrEqual(1);
      expect(result.newSecret).toBe(NEW_SECRET);
    });

    it("still surfaces a row it could not decrypt", () => {
      seedSecret("dry-ok", "sk-fine");
      seedCorrupt("dry-bad");

      expect(() =>
        rotate.rotateMasterKey({
          oldSecret: OLD_SECRET,
          newSecret: NEW_SECRET,
          dryRun: true,
        }),
      ).toThrow(rotate.RotationAbortedError);
    });
  });

  describe("abort", () => {
    it("leaves every row readable with the old key when one row fails", () => {
      const a = seedSecret("abort-a", "sk-abort-alpha");
      const bad = seedCorrupt("abort-bad");
      const c = seedSecret("abort-c", "sk-abort-gamma");
      const before = { a: stored(a), bad: stored(bad), c: stored(c) };

      expect(() =>
        rotate.rotateMasterKey({ oldSecret: OLD_SECRET, newSecret: NEW_SECRET }),
      ).toThrow(rotate.RotationAbortedError);

      // A partial rotation is unrecoverable, so the rollback must be total:
      // rows ordered before AND after the failure stay on the old key.
      expect(stored(a)).toBe(before.a);
      expect(stored(c)).toBe(before.c);
      expect(stored(bad)).toBe(before.bad);
      expect(rotate.decryptWith(oldKey, stored(a))).toBe("sk-abort-alpha");
      expect(rotate.decryptWith(oldKey, stored(c))).toBe("sk-abort-gamma");
    });

    it("names the offending rows in the error", () => {
      seedSecret("abort-ok", "sk-ok");
      const bad = seedCorrupt("abort-named");

      let caught: unknown;
      try {
        rotate.rotateMasterKey({ oldSecret: OLD_SECRET, newSecret: NEW_SECRET });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(rotate.RotationAbortedError);
      const failures = (caught as InstanceType<typeof rotate.RotationAbortedError>).failures;
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({ table: "providers", id: bad, column: "api_key_enc" });
      expect(failures[0].reason).toContain("old key");
    });

    it("aborts when a row was encrypted under a different key", () => {
      const mine = seedSecret("abort-mine", "sk-mine");
      seedSecret("abort-foreign", "sk-foreign", "some-other-master-key-999999");

      expect(() =>
        rotate.rotateMasterKey({ oldSecret: OLD_SECRET, newSecret: NEW_SECRET }),
      ).toThrow(rotate.RotationAbortedError);
      expect(rotate.decryptWith(oldKey, stored(mine))).toBe("sk-mine");
    });
  });

  describe("guards", () => {
    it("refuses to rotate onto the same key", () => {
      expect(() =>
        rotate.rotateMasterKey({ oldSecret: OLD_SECRET, newSecret: OLD_SECRET }),
      ).toThrow(/same master key/);
    });

    it("refuses a new key too short to be worth anything", () => {
      expect(() => rotate.rotateMasterKey({ oldSecret: OLD_SECRET, newSecret: "short" })).toThrow(
        /16 characters/,
      );
    });
  });
});

describe("decryptWith", () => {
  it("throws on an unreadable value rather than returning an empty string", () => {
    // decryptSecret swallows failures, which during rotation would look like an
    // empty secret and overwrite a real key with "".
    expect(() => rotate.decryptWith(oldKey, "not-a-ciphertext")).toThrow(/format/);
    expect(() =>
      rotate.decryptWith(rotate.deriveKey(NEW_SECRET), rotate.encryptWith(oldKey, "x")),
    ).toThrow();
  });

  it("round-trips through encryptWith", () => {
    expect(rotate.decryptWith(oldKey, rotate.encryptWith(oldKey, "hello"))).toBe("hello");
    expect(rotate.encryptWith(oldKey, "")).toBe("");
  });
});
