import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { vi } from "vitest";
import { afterAll, beforeEach, afterEach, describe, expect, it } from "vitest";

import {
  BACKUP_NAME_RE,
  backupSchedulerConfig,
  pruneBackups,
  resetBackupSchedulerStateForTests,
  stopBackupScheduler,
} from "./backup-scheduler";
import { createBackup } from "./backup";

vi.mock("./backup", async () => {
  const actual = await vi.importActual<typeof import("./backup")>("./backup");
  return { ...actual, createBackup: vi.fn(actual.createBackup) };
});

describe("backup scheduler", () => {
  const ROOT = mkdtempSync(join(tmpdir(), "amr-sched-"));

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
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  afterAll(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it("disabled by default", () => {
    delete process.env.AMR_BACKUP_ENABLED;
    expect(backupSchedulerConfig().enabled).toBe(false);
  });

  it("AMR_BACKUP_KEEP abc falls back to 7", () => {
    process.env.AMR_BACKUP_KEEP = "abc";
    expect(backupSchedulerConfig().keep).toBe(7);
  });

  it("AMR_BACKUP_KEEP 0 falls back to 7", () => {
    process.env.AMR_BACKUP_KEEP = "0";
    expect(backupSchedulerConfig().keep).toBe(7);
  });

  it("AMR_BACKUP_KEEP -1 falls back to 7", () => {
    process.env.AMR_BACKUP_KEEP = "-1";
    expect(backupSchedulerConfig().keep).toBe(7);
  });

  it("AMR_BACKUP_DIR empty/whitespace falls back to default", () => {
    delete process.env.AMR_BACKUP_DIR;
    const unsetDir = backupSchedulerConfig().dir;
    for (const v of ["", "   "]) {
      process.env.AMR_BACKUP_DIR = v;
      expect(backupSchedulerConfig().dir).toBe(unsetDir);
    }
    delete process.env.AMR_BACKUP_DIR;
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
    process.env.AMR_BACKUP_INTERVAL_MS = "abc";
    expect(backupSchedulerConfig().intervalMs).toBe(86400000);
  });

  it("AMR_BACKUP_INTERVAL_MS 1000 falls back to 86400000", () => {
    process.env.AMR_BACKUP_INTERVAL_MS = "1000";
    expect(backupSchedulerConfig().intervalMs).toBe(86400000);
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
    expect(backups.sort()).toEqual(["backup-1000000000003", "backup-1000000000004"]);
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
    const targetDir = join(ROOT, "symlinktarget");
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "router.db"), "");
    const name = `backup-${4000000000000}`;
    symlinkSync(targetDir, join(dir, name));
    pruneBackups(dir, 1);
    expect(existsSync(join(dir, name))).toBe(true);
    expect(existsSync(targetDir)).toBe(true);
    expect(existsSync(join(targetDir, "router.db"))).toBe(true);
    rmSync(join(dir, name), { force: true });
    rmSync(targetDir, { recursive: true, force: true });
  });

  it("prune through a symlinked backup dir keeps newest N and symlinked entries", () => {
    const realDir = join(ROOT, "symlinked-backup-real");
    mkdirSync(realDir, { recursive: true });
    for (let i = 0; i < 5; i++) {
      mkdirSync(join(realDir, `backup-${5000000000000 + i}`), { recursive: true });
      writeFileSync(join(realDir, `backup-${5000000000000 + i}`, "router.db"), "");
    }
    const linkEntry = join(realDir, `backup-${9999999999999}`);
    symlinkSync(realDir, linkEntry);
    const symlinkDir = join(ROOT, "symlinked-backup-link");
    symlinkSync(realDir, symlinkDir);
    pruneBackups(symlinkDir, 2);
    const remaining = readdirSync(realDir);
    // symlinked entry counted by name but is a symlink; real backup dirs only:
    const realBackups = remaining.filter((n: string) => {
      try {
        const st = lstatSync(join(realDir, n));
        return BACKUP_NAME_RE.test(n) && st.isDirectory() && !st.isSymbolicLink();
      } catch {
        return false;
      }
    });
    expect(realBackups.sort()).toEqual(["backup-5000000000003", "backup-5000000000004"]);
    expect(existsSync(linkEntry)).toBe(true);
    expect(existsSync(symlinkDir)).toBe(true);
    rmSync(symlinkDir, { force: true });
    rmSync(linkEntry, { force: true });
    rmSync(realDir, { recursive: true, force: true });
  });
});

describe("backup scheduler behavior", () => {
  const ENV_KEYS = [
    "AMR_BACKUP_ENABLED",
    "AMR_BACKUP_INTERVAL_MS",
    "AMR_BACKUP_KEEP",
    "AMR_BACKUP_DIR",
  ];
  let saved: Record<string, string | undefined>;
  let backupDir: string;

  beforeEach(async () => {
    saved = {};
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    vi.useFakeTimers();
    process.env.AMR_BACKUP_ENABLED = "true";
    process.env.AMR_BACKUP_INTERVAL_MS = "60000";
    backupDir = mkdtempSync(join(tmpdir(), "amr-backup-"));
    process.env.AMR_BACKUP_DIR = backupDir;
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    mod.mockReset();
    mod.mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    stopBackupScheduler();
    resetBackupSchedulerStateForTests();
    vi.useRealTimers();
    vi.resetModules();
    rmSync(backupDir, { recursive: true, force: true });
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

  it("stop+start during a pending run never overlaps and resumes after it settles", async () => {
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    let resolveRun!: () => void;
    const pending = new Promise<void>((r) => {
      resolveRun = r;
    });
    mod.mockReturnValueOnce(pending as never);
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(100);
    expect(mod).toHaveBeenCalledTimes(1);
    m.stopBackupScheduler();
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(60000 + 100);
    expect(mod).toHaveBeenCalledTimes(1);
    resolveRun();
    await pending;
    await vi.advanceTimersByTimeAsync(60000 + 100);
    expect(mod).toHaveBeenCalledTimes(2);
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
    await vi.advanceTimersByTimeAsync(60000);
    expect(mod).toHaveBeenCalledTimes(2);
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
    expect(mod.mock.calls.length).toBe(firstCalls);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(mod.mock.calls.length).toBe(firstCalls + 1);
  });

  it("disabled AMR_BACKUP_ENABLED values schedule no timers", async () => {
    for (const v of ["TRUE", "1", "yes", ""]) {
      stopBackupScheduler();
      vi.resetModules();
      process.env.AMR_BACKUP_ENABLED = v;
      const { createBackup } = await import("./backup");
      const mod = vi.mocked(createBackup);
      mod.mockReset();
      mod.mockResolvedValue(undefined as never);
      const m = await import("./backup-scheduler");
      m.startBackupScheduler();
      await vi.advanceTimersByTimeAsync(100);
      expect(vi.getTimerCount()).toBe(0);
      expect(mod).not.toHaveBeenCalled();
    }
  });

  it("failed createBackup cleans up dest dir", async () => {
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    mod.mockImplementation(async (dest: string) => {
      mkdirSync(dest, { recursive: true });
      writeFileSync(join(dest, "partial"), "");
      throw new Error("boom");
      return undefined as unknown as import("./backup").BackupResult;
    });
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(100);
    const dest = mod.mock.calls[0][0] as string;
    expect(existsSync(dest)).toBe(false);
    for (const call of consoleErr.mock.calls) {
      for (const arg of call) {
        expect(String(arg)).not.toContain(backupDir);
      }
    }
    consoleErr.mockRestore();
  });

  it("prune error keeps backup and reschedules", async () => {
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      const throwingReaddir = () => {
        throw new Error("readdir fail");
      };
      return {
        ...actual,
        default: { ...actual, readdirSync: throwingReaddir },
        readdirSync: throwingReaddir,
      };
    });
    vi.resetModules();
    const { createBackup } = await import("./backup");
    const mod = vi.mocked(createBackup);
    mod.mockImplementation(async (dest: string) => {
      mkdirSync(dest, { recursive: true });
      return undefined as unknown as import("./backup").BackupResult;
    });
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = await import("./backup-scheduler");
    m.startBackupScheduler();
    await vi.advanceTimersByTimeAsync(100);
    const dest = mod.mock.calls[0][0] as string;
    expect(existsSync(dest)).toBe(true);
    consoleErr.mockRestore();
    vi.doUnmock("node:fs");
    vi.resetModules();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mod).toHaveBeenCalledTimes(2);
  });
});
