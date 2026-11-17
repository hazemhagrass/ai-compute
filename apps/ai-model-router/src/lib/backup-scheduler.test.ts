import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

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
