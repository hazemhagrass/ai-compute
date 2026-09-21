#!/usr/bin/env node
/**
 * Restore the router database from a backup directory.
 *
 * Usage: node scripts/restore.mjs <backup-dir> [--rekey] [--dry-run]
 *
 * The backup directory must contain router.db (a snapshot made by
 * scripts/backup.mjs or the SQLite backup API). Before anything is
 * swapped, the script checks the snapshot integrity and proves that
 * every stored provider key decrypts under the CURRENT master key.
 * A snapshot whose keys do not decrypt is refused; pass --rekey only
 * when deliberately restoring onto a different master key (rows that
 * do not decrypt are dropped, all-or-nothing). Never point this at a
 * raw copy of a live WAL database.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");

// See scripts/backup.mjs for why this re-execs under jiti.
if (!process.env.AMR_OPS_JITI) {
  const r = spawnSync(
    "pnpm",
    ["exec", "jiti", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    {
      cwd: appDir,
      stdio: "inherit",
      env: { ...process.env, AMR_OPS_JITI: "1" },
    }
  );
  if (r.error) {
    console.error(`failed to launch jiti: ${r.error.message}`);
    process.exit(1);
  }
  if (r.signal) {
    process.kill(process.pid, r.signal);
  }
  process.exit(r.status ?? 1);
}

const args = process.argv.slice(2);
const backupDir = args.find((a) => !a.startsWith("--"));
const rekey = args.includes("--rekey");
const dryRun = args.includes("--dry-run");

if (!backupDir) {
  console.error("usage: node scripts/restore.mjs <backup-dir> [--rekey] [--dry-run]");
  process.exit(2);
}

const { restoreBackup, RestoreError } = await import(
  path.join(appDir, "src/lib/restore.ts")
);

try {
  const result = restoreBackup(path.resolve(backupDir), { rekey, dryRun });
  const mode = dryRun ? "DRY RUN: would restore" : "restored";
  console.log(`${mode}: ${result.unreadableKeys} unreadable key(s)`);
  if (result.safetyBackup) {
    console.log(`previous database moved to ${result.safetyBackup} (delete once verified)`);
  }
  if (result.unreadableKeys > 0) {
    console.warn(
      `warning: ${result.unreadableKeys} row(s) do not decrypt under the current master key`
    );
  }
} catch (err) {
  if (err instanceof RestoreError) {
    console.error(`restore refused: ${err.message}`);
    console.error("nothing was changed.");
  } else {
    console.error(`restore failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  process.exit(1);
}
