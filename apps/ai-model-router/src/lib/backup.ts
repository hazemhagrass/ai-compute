import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { DB_PATH } from "./paths";

export interface BackupResult {
  /** Directory the snapshot was written to. */
  dir: string;
  /** Full path of the snapshot database (always `<dir>/router.db`). */
  dbFile: string;
  /**
   * Full path of the copied master key, or null when no `.secret` file
   * exists (deployments that use AMR_SECRET from the environment must back
   * that value up from their secret manager instead).
   */
  secretFile: string | null;
  /** Row counts in the snapshot, for the operator's log line. */
  providers: number;
  storedKeys: number;
}

export interface BackupOptions {
  /** Source database. Defaults to the app's DB_PATH. */
  srcDbPath?: string;
}

function snapshotStats(dbFile: string): { providers: number; storedKeys: number } {
  const db = new Database(dbFile, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.prepare("PRAGMA integrity_check").pluck().get();
    if (String(integrity).trim() !== "ok") {
      throw new Error(`snapshot failed integrity check: ${JSON.stringify(integrity)}`);
    }
    const hasProviders = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'providers'")
      .get();
    if (!hasProviders) return { providers: 0, storedKeys: 0 };
    const providers = (db.prepare("SELECT COUNT(*) AS n FROM providers").get() as { n: number }).n;
    const storedKeys = (
      db.prepare("SELECT COUNT(*) AS n FROM providers WHERE api_key_enc != ''").get() as {
        n: number;
      }
    ).n;
    return { providers, storedKeys };
  } finally {
    db.close();
  }
}

/**
 * Write a consistent snapshot of the database, plus the master key, into
 * `destDir`.
 *
 * The database runs in WAL mode, so a raw `cp` of router.db can silently
 * miss commits still sitting in router.db-wal, or tear mid-page. This uses
 * SQLite's own backup API (better-sqlite3's `db.backup`), which takes the
 * right locks and produces a checkpointed, self-contained file that needs
 * no -wal/-shm companions. It works while the app is running.
 *
 * The `.secret` file is copied next to the database because the pair is only
 * a backup together: without the key the snapshot is ciphertext nobody can
 * read, and without the database the key guards nothing.
 */
export async function createBackup(
  destDir: string,
  opts: BackupOptions = {},
): Promise<BackupResult> {
  const srcDbPath = opts.srcDbPath ?? DB_PATH;
  if (!fs.existsSync(srcDbPath)) {
    throw new Error(`database not found at ${srcDbPath}`);
  }

  fs.mkdirSync(destDir, { recursive: true });
  const dbFile = path.join(destDir, "router.db");
  for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) {
    fs.rmSync(f, { force: true });
  }

  // A dedicated read-only connection: backing up must not trigger the schema
  // setup and seeding that getDb() performs, and must not need the app to run.
  const src = new Database(srcDbPath, { readonly: true, fileMustExist: true });
  try {
    await src.backup(dbFile);
  } finally {
    src.close();
  }

  // Verify what was written, not what was intended: a backup that does not
  // pass integrity_check is not a backup.
  const { providers, storedKeys } = snapshotStats(dbFile);

  // The verification open may leave -wal/-shm sidecars on the copy; the
  // snapshot must be one self-contained file. An empty -wal means all
  // committed data is already in the main file, so removing the sidecars
  // loses nothing.
  for (const f of [`${dbFile}-wal`, `${dbFile}-shm`]) {
    fs.rmSync(f, { force: true });
  }

  const srcSecret = path.join(path.dirname(srcDbPath), ".secret");
  let secretFile: string | null = null;
  if (fs.existsSync(srcSecret)) {
    secretFile = path.join(destDir, ".secret");
    fs.copyFileSync(srcSecret, secretFile);
    fs.chmodSync(secretFile, 0o600);
  }

  return { dir: destDir, dbFile, secretFile, providers, storedKeys };
}
