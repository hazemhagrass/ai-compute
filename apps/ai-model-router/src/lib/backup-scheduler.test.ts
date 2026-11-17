import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, afterEach, describe, expect, it } from "vitest";

import { BACKUP_NAME_RE, backupSchedulerConfig, pruneBackups } from "./backup-scheduler";
import { createBackup } from "./backup";

describe("backup scheduler", () => {
  const ROOT = mkdtempSync(join(tmpdir(), "amr-sched-"));

  afterAll(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it("disabled by default", () => {
    const prev = process.env.AMR_BACKUP_ENABLED;
    delete process.env.AMR_BACKUP_ENABLED;
    expect(backupSchedulerConfig().enabled).toBe(false);
    if (prev !== undefined) process.env.AMR_BACKUP_ENABLED = prev;
  });

  it("AMR_BACKUP_KEEP abc falls back to 7", () => {
    const prev = process.env.AMR_BACKUP_KEEP;
    process.env.AMR_BACKUP_KEEP = "abc";
    expect(backupSchedulerConfig().keep).toBe(7);
    if (prev !== undefined) process.env.AMR_BACKUP_KEEP = prev;
    else delete process.env.AMR_BACKUP_KEEP;
  });

  it("AMR_BACKUP_KEEP 0 falls back to 7", () => {
    const prev = process.env.AMR_BACKUP_KEEP;
    process.env.AMR_BACKUP_KEEP = "0";
    expect(backupSchedulerConfig().keep).toBe(7);
    if (prev !== undefined) process.env.AMR_BACKUP_KEEP = prev;
    else delete process.env.AMR_BACKUP_KEEP;
  });

  it("AMR_BACKUP_KEEP -1 falls back to 7", () => {
    const prev = process.env.AMR_BACKUP_KEEP;
    process.env.AMR_BACKUP_KEEP = "-1";
    expect(backupSchedulerConfig().keep).toBe(7);
    if (prev !== undefined) process.env.AMR_BACKUP_KEEP = prev;
    else delete process.env.AMR_BACKUP_KEEP;
  });

  it("pruneBackups(dir,0) deletes nothing", () => {
    const dir = join(ROOT, "p0");
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 3; i++) {
      mkdirSync(join(dir, `backup-${1000000000000 + i}`), { recursive: true });
      writeFileSync(join(dir, `backup-${1000000000000 + i}`, "router.db"), "");
    }
    pruneBackups(dir, 0);
    const remaining = readdirSync(dir).filter((n: string) => BACKUP_NAME_RE.test(n));
    expect(remaining.length).toBe(3);
  });

  it("pruneBackups(dir,-1) deletes nothing", () => {
    const dir = join(ROOT, "pm1");
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 3; i++) {
      mkdirSync(join(dir, `backup-${2000000000000 + i}`), { recursive: true });
      writeFileSync(join(dir, `backup-${2000000000000 + i}`, "router.db"), "");
    }
    pruneBackups(dir, -1);
    const remaining = readdirSync(dir).filter((n: string) => BACKUP_NAME_RE.test(n));
    expect(remaining.length).toBe(3);
  });

  it("AMR_BACKUP_INTERVAL_MS abc falls back to 86400000", () => {
    const prev = process.env.AMR_BACKUP_INTERVAL_MS;
    process.env.AMR_BACKUP_INTERVAL_MS = "abc";
    expect(backupSchedulerConfig().intervalMs).toBe(86400000);
    if (prev !== undefined) process.env.AMR_BACKUP_INTERVAL_MS = prev;
    else delete process.env.AMR_BACKUP_INTERVAL_MS;
  });

  it("AMR_BACKUP_INTERVAL_MS 1000 falls back to 86400000", () => {
    const prev = process.env.AMR_BACKUP_INTERVAL_MS;
    process.env.AMR_BACKUP_INTERVAL_MS = "1000";
    expect(backupSchedulerConfig().intervalMs).toBe(86400000);
    if (prev !== undefined) process.env.AMR_BACKUP_INTERVAL_MS = prev;
    else delete process.env.AMR_BACKUP_INTERVAL_MS;
  });

  it("a run writes a backup", async () => {
    const dir = join(ROOT, "d1");
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, "router.db");
    const { default: Database } = await import("better-sqlite3");
    const db = new (Database as unknown as new (p: string) => { exec: (s: string) => void; close: () => void })(dbPath);
    db.exec("CREATE TABLE providers (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, api_key_enc TEXT)");
    db.close();
    const backupDir = join(ROOT, "backups1");
    mkdirSync(backupDir, { recursive: true });
    const name = `backup-${Date.now()}`;
    const dest = join(backupDir, name);
    await createBackup(dest, { srcDbPath: dbPath });
    expect(existsSync(join(dest, "router.db"))).toBe(true);
  });

  it("retention prunes to N and keeps unrelated files", () => {
    const dir = join(ROOT, "backups2");
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 5; i++) {
      mkdirSync(join(dir, `backup-${1000000000000 + i}`), { recursive: true });
      writeFileSync(join(dir, `backup-${1000000000000 + i}`, "router.db"), "");
    }
    writeFileSync(join(dir, "decoy.txt"), "x");
    mkdirSync(join(dir, "other-dir"), { recursive: true });
    pruneBackups(dir, 2);
    const remaining = readdirSync(dir);
    const backups = remaining.filter((n: string) => BACKUP_NAME_RE.test(n));
    expect(backups.length).toBe(2);
    expect(remaining).toContain("decoy.txt");
    expect(remaining).toContain("other-dir");
  });

  it("a matching dir without router.db survives", () => {
    const dir = join(ROOT, "nodb");
    mkdirSync(dir, { recursive: true });
    const name = `backup-${3000000000000}`;
    mkdirSync(join(dir, name), { recursive: true });
    pruneBackups(dir, 1);
    expect(existsSync(join(dir, name))).toBe(true);
  });

  it("a symlink named backup-13digits survives", () => {
    const dir = join(ROOT, "symlink");
    mkdirSync(dir, { recursive: true });
    const name = `backup-${4000000000000}`;
    symlinkSync("/tmp", join(dir, name));
    pruneBackups(dir, 1);
    expect(existsSync(join(dir, name))).toBe(true);
    rmSync(join(dir, name), { force: true });
  });
});

import { vi } from "vitest";
import { stopBackupScheduler } from "./backup-scheduler";

vi.mock("./backup", async () => {
  const actual = await vi.importActual<typeof import("./backup")>("./backup");
  return { ...actual, createBackup: vi.fn(actual.createBackup) };
});

describe("backup scheduler behavior", () => {
  const ENV_KEYS = [
    "AMR_BACKUP_ENABLED",
    "AMR_BACKUP_INTERVAL_MS",
    "AMR_BACKUP_KEEP",
    "AMR_BACKUP_DIR",
  ];
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    vi.useFakeTimers();
    process.env.AMR_BACKUP_ENABLED = "true";
    process.env.AMR_BACKUP_INTERVAL_MS = "60000";
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    stopBackupScheduler();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("overflow 30 days falls back to 24h and warns", async () => {
    process.env.AMR_BACKUP_INTERVAL_MS = "2592000000";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cfg = (await import("./backup-scheduler")).backupSchedulerConfig();
    expect(cfg.intervalMs).toBe(86400000);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("2147483647 accepted", async () => {
    process.env.AMR_BACKUP_INTERVAL_MS = "2147483647";
    const cfg = (await import("./backup-scheduler")).backupSchedulerConfig();
    expect(cfg.intervalMs).toBe(2147483647);
  });

  it("stop before initial: no createBackup, no timers", async () => {
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    m.stopBackupScheduler();
    await vi.advanceTimersByTimeAsync(100);
    expect(mod).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("overlap: createBackup never resolves, called once after two intervals", async () => {
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    mod.mockReturnValue(new Promise(() => {}));
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(200000);
    expect(mod).toHaveBeenCalledTimes(1);
  });

  it("log hygiene: error logged without secret path", async () => {
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    const err = new Error("boom /secret/path/router.db") as Error & { code?: string };
    err.code = "EACCES";
    mod.mockRejectedValue(err);
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(100);
    expect(consoleErr).toHaveBeenCalled();
    for (const call of consoleErr.mock.calls) {
      for (const arg of call) {
        expect(String(arg)).not.toContain("/secret/path");
      }
    }
    consoleErr.mockRestore();
  });

  it("hot reload: only one schedule", async () => {
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    const m1 = await import("./backup-scheduler");
    m1.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(100);
    const firstCalls = mod.mock.calls.length;
    vi.resetModules();
    const m2 = await import("./backup-scheduler");
    m2.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(100);
    // ensure no duplicate explosion: total calls should be firstCalls + 1 at most for initial
    expect(mod.mock.calls.length).toBeLessThanOrEqual(firstCalls + 1);
  });
});
