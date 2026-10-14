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
  unreadableKeys: number;
  safetyBackup: string | null;
  dryRun: boolean;
}

export interface RestoreOptions {
  currentSecret?: string;
  rekey?: boolean;
  destDbPath?: string;
  dryRun?: boolean;
}

function resolveSecret(dbFile: string): string {
  const fromEnv = process.env.AMR_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const file = path.join(path.dirname(dbFile), ".secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();

  throw new RestoreError(
    "no master key found: set AMR_SECRET, restore a .secret file, or pass currentSecret",
  );
}

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
