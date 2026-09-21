import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

import { getDb } from "./db";
import { DATA_DIR } from "./paths";

/*
 * Master key rotation.
 *
 * `crypto.ts` derives one process-wide key and caches it, which is right for
 * normal traffic but useless here: rotation needs two keys alive at once (the
 * old one to read, the new one to write). So this module re-implements the
 * exact `v1.<iv>.<tag>.<ct>` wire format against an explicit key instead of the
 * ambient one. The format must stay byte-compatible with `crypto.ts` or the app
 * cannot read what we just wrote.
 */

const ALGO = "aes-256-gcm";
const KDF_SALT = "ai-model-router.v1";
const FORMAT = "v1";

/** Tables/columns holding a `v1.` ciphertext. Add here when a new one appears. */
const SECRET_COLUMNS: ReadonlyArray<{ table: string; idColumn: string; column: string }> = [
  { table: "providers", idColumn: "id", column: "api_key_enc" },
];

/* ------------------------------------------------------------ key material */

/** Derive the AES key from a master secret, identically to `crypto.ts`. */
export function deriveKey(masterSecret: string): Buffer {
  return crypto.scryptSync(masterSecret, KDF_SALT, 32);
}

/** Encrypt with an explicit key. Mirrors `encryptSecret` from crypto.ts. */
export function encryptWith(key: Buffer, plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

/**
 * Decrypt with an explicit key.
 *
 * Unlike `decryptSecret`, this THROWS on a malformed or unauthenticated value
 * instead of returning "". Swallowing the error is fine when rendering a page,
 * but during rotation an unreadable row that looks like an empty one would be
 * silently overwritten with "" and the secret lost forever.
 */
export function decryptWith(key: Buffer, stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== FORMAT) {
    throw new Error(`unrecognized ciphertext format (expected "${FORMAT}.<iv>.<tag>.<ct>")`);
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const ct = Buffer.from(parts[3], "base64url");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** A fresh master secret, same shape and entropy as the auto-generated one. */
export function generateMasterSecret(): string {
  return crypto.randomBytes(48).toString("base64url");
}

/**
 * Read the master secret currently in force WITHOUT creating one.
 *
 * `crypto.ts` generates a secret as a side effect of reading a missing file.
 * Doing that here would hand us a brand new key and every stored row would then
 * fail to decrypt, so this variant refuses instead.
 */
export function currentMasterSecret(): string {
  const fromEnv = process.env.AMR_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const file = path.join(DATA_DIR, ".secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();

  throw new Error(
    "no master key found: set AMR_SECRET or pass oldSecret explicitly before rotating",
  );
}

/* ---------------------------------------------------------------- results */

export interface RotatedRow {
  table: string;
  id: number;
  column: string;
}

export interface RotationFailure {
  table: string;
  id: number;
  column: string;
  reason: string;
}

export interface RotationResult {
  /** Rows whose ciphertext was re-encrypted and verified. */
  rotated: number;
  /** Rows with no secret stored. Nothing to re-encrypt, so left alone. */
  skipped: number;
  /** The caller persists this (AMR_SECRET or <DATA_DIR>/.secret). */
  newSecret: string;
  /** True when nothing was committed. */
  dryRun: boolean;
  rows: RotatedRow[];
}

/** Thrown when any row fails, after the transaction has been rolled back. */
export class RotationAbortedError extends Error {
  readonly failures: RotationFailure[];

  constructor(failures: RotationFailure[]) {
    const first = failures[0];
    super(
      `master key rotation aborted after ${failures.length} failure(s); ` +
        `no rows were changed. First: ${first.table}#${first.id}.${first.column}: ${first.reason}`,
    );
    this.name = "RotationAbortedError";
    this.failures = failures;
  }
}

export interface RotateOptions {
  /** Defaults to the app database. */
  db?: Database.Database;
  /** Key the rows are currently encrypted with. Defaults to the live one. */
  oldSecret?: string;
  /** Key to move to. Defaults to a freshly generated one. */
  newSecret?: string;
  /** Report what would happen and commit nothing. */
  dryRun?: boolean;
}

/** Internal sentinel: the only way to roll back a successful dry run. */
class DryRunRollback extends Error {
  readonly result: RotationResult;

  constructor(result: RotationResult) {
    super("dry run");
    this.result = result;
  }
}

interface SecretRow {
  id: number;
  value: string | null;
}

/* --------------------------------------------------------------- rotation */

/**
 * Re-encrypt every stored secret under a new master key.
 *
 * Atomicity is the whole point of this function. A rotation that stops halfway
 * leaves some rows on the old key and some on the new, and since only one key
 * can be active at a time, whichever half loses is unrecoverable: the plaintext
 * exists nowhere else. So every read, write and verification happens inside one
 * better-sqlite3 transaction, and any thrown error rolls the entire thing back
 * to the old key rather than leaving a mixed database behind.
 *
 * Verification is the second half of that guarantee. Each new ciphertext is
 * read back out of the database and decrypted with the new key, and the result
 * must equal the original plaintext byte for byte before the transaction is
 * allowed to commit. We never keep a value we have not already proven we can
 * read back.
 */
export function rotateMasterKey(opts: RotateOptions = {}): RotationResult {
  const db = opts.db ?? getDb();
  const oldSecret = opts.oldSecret ?? currentMasterSecret();
  const newSecret = opts.newSecret ?? generateMasterSecret();
  const dryRun = opts.dryRun === true;

  if (newSecret.length < 16) {
    throw new Error("refusing to rotate onto a master key shorter than 16 characters");
  }
  if (newSecret === oldSecret) {
    throw new Error("refusing to rotate onto the same master key");
  }

  const oldKey = deriveKey(oldSecret);
  const newKey = deriveKey(newSecret);

  const run = db.transaction((): RotationResult => {
    const failures: RotationFailure[] = [];
    const rows: RotatedRow[] = [];
    let skipped = 0;

    for (const target of SECRET_COLUMNS) {
      const select = db.prepare(
        `SELECT ${target.idColumn} AS id, ${target.column} AS value FROM ${target.table}`,
      );
      const readBack = db.prepare(
        `SELECT ${target.column} AS value FROM ${target.table} WHERE ${target.idColumn} = ?`,
      );
      const update = db.prepare(
        `UPDATE ${target.table} SET ${target.column} = ? WHERE ${target.idColumn} = ?`,
      );

      for (const row of select.all() as SecretRow[]) {
        const stored = row.value ?? "";
        // An empty column is "no key configured", not a decryption failure.
        if (stored === "") {
          skipped++;
          continue;
        }

        const fail = (reason: string) =>
          failures.push({ table: target.table, id: row.id, column: target.column, reason });

        let plain: string;
        try {
          plain = decryptWith(oldKey, stored);
        } catch (err) {
          fail(`cannot decrypt with the old key: ${(err as Error).message}`);
          continue;
        }

        const reencrypted = encryptWith(newKey, plain);
        update.run(reencrypted, row.id);

        // Read back from the database rather than trusting the local string, so
        // a bad column type or truncating write is caught before we commit.
        const after = (readBack.get(row.id) as { value: string | null } | undefined)?.value ?? "";
        let verified: string;
        try {
          verified = decryptWith(newKey, after);
        } catch (err) {
          fail(`re-encrypted value is unreadable with the new key: ${(err as Error).message}`);
          continue;
        }
        if (verified !== plain) {
          fail("re-encrypted value did not round-trip to the original plaintext");
          continue;
        }

        rows.push({ table: target.table, id: row.id, column: target.column });
      }
    }

    // Throwing inside db.transaction rolls back every statement above.
    if (failures.length) throw new RotationAbortedError(failures);

    const result: RotationResult = {
      rotated: rows.length,
      skipped,
      newSecret,
      dryRun,
      rows,
    };

    // A dry run does the real work, including the verification pass, then
    // deliberately fails so nothing is committed. Reporting on a rehearsal that
    // never touched the database would not prove the real run can succeed.
    if (dryRun) throw new DryRunRollback(result);

    return result;
  });

  try {
    return run();
  } catch (err) {
    if (err instanceof DryRunRollback) return err.result;
    throw err;
  }
}
