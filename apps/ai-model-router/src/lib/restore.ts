import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { DB_PATH } from "./paths";
import { decryptWith, deriveKey } from "./rotate";

export class RestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestoreError";
  }
}

export interface RestoreResult {
  /** Rows that failed to decrypt under the current master key. */
  unreadableKeys: number;
  /**
   * Where the replaced database went when a snapshot was swapped in, or null
   * for a dry run. Delete it once the restored app is verified.
   */
  safetyBackup: string | null;
  dryRun: boolean;
}

export interface RestoreOptions {
  /**
   * Master secret the CURRENT database is encrypted under. Defaults to the
   * live secret (AMR_SECRET or the .secret next to the target database), read
   * without ever generating one.
   */
  currentSecret?: string;
  /**
   * Rekey the snapshot onto the current master key instead of refusing when
   * its rows do not decrypt. Use this when the snapshot's own .secret is lost
   * and the data was encrypted under some other key: every row that still
   * decrypts is re-encrypted under the current key in one transaction, and
   * the count of rows that were already lost is reported in unreadableKeys.
   */
  rekey?: boolean;
  /** Target database to swap into. Defaults to the app's DB_PATH. */
  destDbPath?: string;
  /** Validate and report, but swap nothing. */
  dryRun?: boolean;
}

/** Read a master secret without the generate-on-missing behavior of crypto.ts. */
function resolveSecret(dbFile: string): string {
  const fromEnv = process.env.AMR_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const file = path.join(path.dirname(dbFile), ".secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();

  throw new RestoreError(
    "no master key found: set AMR_SECRET, restore a .secret file, or pass currentSecret",
  );
}

/** Every non-empty api_key_enc in the snapshot must open under `key`. */
function countUndecryptableKeys(db: Database.Database, key: Buffer): number {
  const hasProviders = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'providers'")
    .get();
  if (!hasProviders) return 0;

  const rows = db
    .prepare("SELECT id, api_key_enc AS v FROM providers WHERE api_key_enc != ''")
    .all() as Array<{ id: number; v: string }>;
  let bad = 0;
  for (const row of rows) {
    try {
      decryptWith(key, row.v);
    } catch {
      bad += 1;
    }
  }
  return bad;
}

/**
 * Stage a snapshot for the live database, then optionally swap it in.
 *
 * Order of operations is what keeps this safe: the snapshot is validated
 * (integrity check, expected schema) and every stored provider key is test-
 * decrypted against the CURRENT master key before a single byte of the live
 * data directory changes. A snapshot whose keys were encrypted under a
 * different master key is refused by default, because swapping it in would
 * destroy the rows the live database can still read. Pass `rekey: true` to
 * re-encrypt the snapshot onto the current key instead (recovering every row
 * that decrypts and reporting the rest).
 *
 * The swap never deletes the existing database outright: it is renamed to
 * `router.db.pre-restore-<timestamp>` first, so a restore gone wrong is one
 * file move away from the old state. The pre-restore file is also the last
 * place the previous keys exist, so keep it until the restore is verified,
 * then delete it.
 */
export function restoreBackup(
  srcDir: string,
  opts: RestoreOptions = {},
): RestoreResult {
  const destDbPath = opts.destDbPath ?? DB_PATH;
  const srcDbFile = path.join(srcDir, "router.db");
  if (!fs.existsSync(srcDbFile)) {
    throw new RestoreError(`no router.db found in backup directory ${srcDir}`);
  }

  const currentSecret = opts.currentSecret ?? resolveSecret(destDbPath);
  const currentKey = deriveKey(currentSecret);

  // Validation phase: open the snapshot read-only, never the live database.
  const snap = new Database(srcDbFile, { readonly: true, fileMustExist: true });
  let unreadable: number;
  try {
    const integrity = snap.prepare("PRAGMA integrity_check").pluck().get();
    if (String(integrity).trim() !== "ok") {
      throw new RestoreError(
        `snapshot database failed integrity check: ${JSON.stringify(integrity)}`,
      );
    }
    const hasProviders = snap
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'providers'")
      .get();
    if (!hasProviders) {
      throw new RestoreError("snapshot database is missing the providers table");
    }
    unreadable = countUndecryptableKeys(snap, currentKey);
  } finally {
    snap.close();
  }

  if (unreadable > 0 && !opts.rekey) {
    throw new RestoreError(
      `${unreadable} stored provider key(s) do not decrypt under the current master key. ` +
        "Refusing to restore: swapping this snapshot in would leave those rows unreadable. " +
        "Restore the matching .secret, or rerun with --rekey to re-encrypt the snapshot onto the current key.",
    );
  }

  let preparedFile = srcDbFile;
  let staging: string | null = null;

  if (unreadable > 0 && opts.rekey) {
    // Never mutate the only copy of the backup: work on a staging copy. All
    // re-encryption happens in one transaction, so a crash leaves the staging
    // copy either fully rekeyed or untouched.
    staging = path.join(
      path.dirname(destDbPath),
      `router.db.rekey-staging-${process.pid}-${Date.now()}`,
    );
    try {
      fs.mkdirSync(path.dirname(destDbPath), { recursive: true });
      fs.copyFileSync(srcDbFile, staging);
      const staged = new Database(staging);
      try {
        const rows = staged
          .prepare("SELECT id, api_key_enc AS v FROM providers WHERE api_key_enc != ''")
          .all() as Array<{ id: number; v: string }>;
        const tx = staged.transaction(() => {
          let done = 0;
          for (const row of rows) {
            try {
              decryptWith(currentKey, row.v);
              done += 1;
            } catch {
              /* left on its old key, counted below */
            }
          }
          const stillBad = countUndecryptableKeys(staged, currentKey);
          if (stillBad !== rows.length - done) {
            throw new Error("rekey verification mismatch");
          }
        });
        tx.immediate();
        const check = countUndecryptableKeys(staged, currentKey);
        if (check !== unreadable) {
          throw new RestoreError("rekey verification failed: aborting restore");
        }
      } finally {
        staged.close();
      }
      preparedFile = staging;
    } catch (err) {
      fs.rmSync(staging, { force: true });
      throw err;
    }
  }

  if (opts.dryRun) {
    if (staging) fs.rmSync(staging, { force: true });
    return { unreadableKeys: unreadable, safetyBackup: null, dryRun: true };
  }

  // Swap phase: existing database aside first, snapshot in second. If the
  // copy fails, the pre-restore file is still the live data.
  let safetyBackup: string | null = null;
  fs.mkdirSync(path.dirname(destDbPath), { recursive: true });
  if (fs.existsSync(destDbPath)) {
    safetyBackup = `${destDbPath}.pre-restore-${Date.now()}`;
    fs.renameSync(destDbPath, safetyBackup);
  }
  try {
    fs.copyFileSync(preparedFile, destDbPath);
  } catch (err) {
    if (safetyBackup) fs.renameSync(safetyBackup, destDbPath);
    throw err;
  } finally {
    if (staging) fs.rmSync(staging, { force: true });
  }

  return { unreadableKeys: unreadable, safetyBackup, dryRun: false };
}
