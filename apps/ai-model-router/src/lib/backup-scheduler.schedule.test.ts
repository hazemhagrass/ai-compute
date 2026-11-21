import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { vi } from "vitest";
import { beforeEach, afterEach, describe, expect, it } from "vitest";

import { BACKUP_NAME_RE, backupSchedulerConfig, stopBackupScheduler } from "./backup-scheduler";

vi.mock("./backup", async () => {
  const actual = await vi.importActual<typeof import("./backup")>("./backup");
  return { ...actual, createBackup: vi.fn(actual.createBackup) };
});

describe("backup scheduler schedule (new)", () => {
  const ENV_KEYS = ["AMR_BACKUP_ENABLED", "AMR_BACKUP_INTERVAL_MS", "AMR_BACKUP_KEEP", "AMR_BACKUP_DIR"];
  let saved: Record<string, string | undefined>;
  let backupDir: string;

  beforeEach(async () => {
    saved = {};
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    vi.useFakeTimers();
    process.env.AMR_BACKUP_ENABLED = "true";
    process.env.AMR_BACKUP_INTERVAL_MS = "60000";
    backupDir = mkdtempSync(join(tmpdir(), "amr-sched2-"));
    process.env.AMR_BACKUP_DIR = backupDir;
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    mod.mockReset();
    mod.mockImplementation(async (dest: string) => {
      mkdirSync(dest, { recursive: true });
      writeFileSync(join(dest, "router.db"), "");
      return undefined as never;
    });
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    stopBackupScheduler();
    vi.useRealTimers();
    vi.resetModules();
    rmSync(backupDir, { recursive: true, force: true });
  });

  // Major 2: startup delay
  it("startup delay: recent backup delays first run to newest + interval", async () => {
    const recent = Date.now();
    mkdirSync(join(backupDir, `backup-${recent}`), { recursive: true });
    writeFileSync(join(backupDir, `backup-${recent}`, "router.db"), "");
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    // just before
    await vi.advanceTimersByTimeAsync(60000 - 1);
    expect(mod).not.toHaveBeenCalled();
    // past
    await vi.advanceTimersByTimeAsync(2);
    expect(mod).toHaveBeenCalledTimes(1);
  });

  it("startup delay: no existing backup runs at 0", async () => {
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(mod).toHaveBeenCalledTimes(1);
  });

  it("startup delay: older-than-interval backup runs at 0", async () => {
    const old = Date.now() - 120000;
    mkdirSync(join(backupDir, `backup-${old}`), { recursive: true });
    writeFileSync(join(backupDir, `backup-${old}`, "router.db"), "");
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(0);
    expect(mod).toHaveBeenCalledTimes(1);
  });

  // Major 3a: retention
  it("retention: keeps newest 2 including new backup", async () => {
    for (let i = 0; i < 3; i++) {
      const t = 1000000000000 + i;
      mkdirSync(join(backupDir, `backup-${t}`), { recursive: true });
      writeFileSync(join(backupDir, `backup-${t}`, "router.db"), "");
    }
    process.env.AMR_BACKUP_KEEP = "2";
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(100);
    const remaining = readdirSync(backupDir).filter((n) => BACKUP_NAME_RE.test(n));
    expect(remaining.length).toBe(2);
  });

  // Major 3b: prune error
  it("prune error: logs prune failed, backup remains, reschedules", async () => {
    process.env.AMR_BACKUP_KEEP = "1";
    for (let i = 0; i < 2; i++) {
      const t = 2000000000000 + i;
      mkdirSync(join(backupDir, `backup-${t}`), { recursive: true });
      writeFileSync(join(backupDir, `backup-${t}`, "router.db"), "");
    }
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      const throwing = () => { throw new Error("readdir fail"); };
      return { ...actual, default: { ...actual, readdirSync: throwing }, readdirSync: throwing };
    });
    vi.resetModules();
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    mod.mockImplementation(async (dest: string) => { mkdirSync(dest, { recursive: true }); writeFileSync(join(dest, "router.db"), ""); return undefined as never; });
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(100);
    const dest = mod.mock.calls[0][0] as string;
    expect(existsSync(dest)).toBe(true);
    expect(consoleErr).toHaveBeenCalled();
    expect(consoleErr.mock.calls.some((c) => c.some((a) => String(a).includes("prune failed")))).toBe(true);
    consoleErr.mockRestore();
    vi.doUnmock("node:fs");
    vi.resetModules();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mod).toHaveBeenCalledTimes(2);
  });

  // Minor 3: overlap warning
  it("overlap: skipped run logs warning", async () => {
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    mod.mockReturnValue(new Promise(() => {}));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(120000);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  // Minor 7: relative dir
  it("relative AMR_BACKUP_DIR resolves to absolute", () => {
    process.env.AMR_BACKUP_DIR = "relative/backups";
    const cfg = backupSchedulerConfig();
    expect(cfg.dir.startsWith("/")).toBe(true);
    delete process.env.AMR_BACKUP_DIR;
  });

  // Interval bounds
  it("interval 60000 accepted", () => {
    process.env.AMR_BACKUP_INTERVAL_MS = "60000";
    expect(backupSchedulerConfig().intervalMs).toBe(60000);
  });

  it("interval 59999 rejected", () => {
    process.env.AMR_BACKUP_INTERVAL_MS = "59999";
    expect(backupSchedulerConfig().intervalMs).toBe(86400000);
  });
});
