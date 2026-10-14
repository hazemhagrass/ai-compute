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
