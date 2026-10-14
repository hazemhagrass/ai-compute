import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

import { getDb } from "./db";
import { DATA_DIR } from "./paths";

const ALGO = "aes-256-gcm";
const KDF_SALT = "ai-model-router.v1";
const FORMAT = "v1";

const SECRET_COLUMNS: ReadonlyArray<{ table: string; idColumn: string; column: string }> = [
  { table: "providers", idColumn: "id", column: "api_key_enc" },
];

export function deriveKey(masterSecret: string): Buffer {
  return crypto.scryptSync(masterSecret, KDF_SALT, 32);
}

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

export function generateMasterSecret(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function currentMasterSecret(): string {
  const fromEnv = process.env.AMR_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const file = path.join(DATA_DIR, ".secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();

  throw new Error(
    "no master key found: set AMR_SECRET or pass oldSecret explicitly before rotating",
  );
}

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
  rotated: number;
  skipped: number;
  newSecret: string;
  dryRun: boolean;
  rows: RotatedRow[];
}

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
  db?: Database.Database;
  oldSecret?: string;
  newSecret?: string;
  dryRun?: boolean;
}

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

    if (failures.length) throw new RotationAbortedError(failures);

    const result: RotationResult = {
      rotated: rows.length,
      skipped,
      newSecret,
      dryRun,
      rows,
    };

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
