import fs from "node:fs";
import path from "node:path";

import { createBackup } from "./backup";
import { DATA_DIR } from "./paths";

export const BACKUP_NAME_RE = /^backup-\d{13}$/;

export function backupSchedulerConfig() {
  const rawInterval = Number(process.env.AMR_BACKUP_INTERVAL_MS ?? 24 * 60 * 60 * 1000);
  const rawKeep = Number(process.env.AMR_BACKUP_KEEP ?? 7);
  let intervalMs = rawInterval;
  const MAX_SAFE_INTERVAL = 2147483647;
  if (
    !Number.isInteger(intervalMs) ||
    intervalMs < 60000 ||
    intervalMs > MAX_SAFE_INTERVAL
  ) {
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

const STATE_KEY = Symbol.for("ai-model-router.backup-scheduler");
type SchedulerState = { started: boolean; timer: NodeJS.Timeout | null; initial: NodeJS.Timeout | null; running: boolean };

function getState(): SchedulerState {
  const g = globalThis as Record<symbol, SchedulerState>;
  if (!g[STATE_KEY]) g[STATE_KEY] = { started: false, timer: null, initial: null, running: false };
  return g[STATE_KEY];
}

export function startBackupScheduler(): void {
  const state = getState();
  if (state.started) return;
  const cfg = backupSchedulerConfig();
  if (!cfg.enabled) return;
  state.started = true;
  const run = async () => {
    if (state.running) return;
    state.running = true;
    try {
      const name = `backup-${Date.now()}`;
      const dest = path.join(cfg.dir, name);
      await createBackup(dest);
      pruneBackups(cfg.dir, cfg.keep);
    } catch (err) {
      const code = (err as { code?: unknown; name?: unknown })?.code ?? (err as { name?: unknown })?.name;
      console.error("[backup-scheduler] run failed:", code ?? "Error");
    } finally {
      state.running = false;
    }
  };
  state.initial = setTimeout(() => {
    void run();
    state.timer = setInterval(() => void run(), cfg.intervalMs);
    if (state.timer && typeof state.timer.unref === "function") state.timer.unref();
  }, 0);
  if (state.initial && typeof state.initial.unref === "function") state.initial.unref();
}

export function stopBackupScheduler(): void {
  const state = getState();
  if (state.timer) clearInterval(state.timer);
  if (state.initial) clearTimeout(state.initial);
  state.timer = null;
  state.initial = null;
  state.started = false;
  state.running = false;
}
