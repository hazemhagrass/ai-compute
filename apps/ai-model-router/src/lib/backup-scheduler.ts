import fs from "node:fs";
import path from "node:path";

import { createBackup } from "./backup";
import { DATA_DIR } from "./paths";

export const BACKUP_NAME_RE = /^backup-\d{13}$/;

export function backupSchedulerConfig() {
  const rawInterval = Number(process.env.AMR_BACKUP_INTERVAL_MS ?? 24 * 60 * 60 * 1000);
  const rawKeep = Number(process.env.AMR_BACKUP_KEEP ?? 7);
  let intervalMs = rawInterval;
  if (!Number.isInteger(intervalMs) || intervalMs < 60000) {
    console.warn("[backup-scheduler] invalid AMR_BACKUP_INTERVAL_MS, using 24h");
    intervalMs = 24 * 60 * 60 * 1000;
  }
  let keep = rawKeep;
  if (!Number.isInteger(keep) || keep < 1) {
    console.warn("[backup-scheduler] invalid AMR_BACKUP_KEEP, using 7");
    keep = 7;
  }
  return {
    enabled: process.env.AMR_BACKUP_ENABLED === "true",
    intervalMs,
    keep,
    dir:
      process.env.AMR_BACKUP_DIR ?? path.join(DATA_DIR, "backups"),
  };
}

export function pruneBackups(dir: string, keep: number): string[] {
  if (!Number.isInteger(keep) || keep < 1) return [];
  if (!fs.existsSync(dir)) return [];
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) return [];
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.isSymbolicLink())
    .filter((e) => BACKUP_NAME_RE.test(e.name))
    .filter((e) => fs.existsSync(path.join(dir, e.name, "router.db")))
    .map((e) => e.name)
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .reverse();
  const removed: string[] = [];
  for (const name of entries.slice(keep)) {
    const full = path.join(dir, name);
    fs.rmSync(full, { recursive: true, force: true });
    removed.push(name);
  }
  return removed;
}

let started = false;
let timer: NodeJS.Timeout | null = null;

export function startBackupScheduler(): void {
  if (started) return;
  const cfg = backupSchedulerConfig();
  if (!cfg.enabled) return;
  started = true;
  const run = async () => {
    try {
      const name = `backup-${Date.now()}`;
      const dest = path.join(cfg.dir, name);
      await createBackup(dest);
      pruneBackups(cfg.dir, cfg.keep);
    } catch (err) {
      console.error("[backup-scheduler] run failed:", err);
    }
  };
  setTimeout(() => {
    void run();
    timer = setInterval(() => void run(), cfg.intervalMs);
    if (timer && typeof timer.unref === "function") timer.unref();
  }, 0);
}

export function stopBackupScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}