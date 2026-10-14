#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");

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
