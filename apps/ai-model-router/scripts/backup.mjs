#!/usr/bin/env node
/**
 * Back up the router database and master key.
 *
 * Usage: node scripts/backup.mjs <dest-dir>
 *
 * Writes <dest-dir>/router.db (a consistent SQLite snapshot taken with the
 * better-sqlite3 backup API, safe against a live WAL database) plus
 * <dest-dir>/.secret (the master key, mode 600). The database and the key
 * are a pair: back them up together, always. Losing .secret makes every
 * key stored in the database unrecoverable.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");

// Re-exec under `pnpm exec jiti` when not already running inside jiti, so
// the TypeScript sources in src/lib can be imported without a build step.
// jiti ships in the dependency tree (Next and ESLint pull it in) but is not
// resolvable as a bare package import from here under pnpm.
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

const destDir = process.argv[2];
if (!destDir) {
  console.error("usage: node scripts/backup.mjs <dest-dir>");
  process.exit(2);
}

const { createBackup } = await import(path.join(appDir, "src/lib/backup.ts"));

try {
  const result = await createBackup(path.resolve(destDir));
  console.log(`database snapshot: ${result.dbFile}`);
  console.log(`contents:          ${result.providers} providers, ${result.storedKeys} stored keys (integrity ok)`);
  console.log(
    result.secretFile
      ? `master key:        ${result.secretFile} (mode 600)`
      : "master key:        no .secret file found; back up the AMR_SECRET value from your secret manager"
  );
} catch (err) {
  console.error(`backup failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
