import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { BACKUP_NAME_RE, backupSchedulerConfig, pruneBackups } from "./backup-scheduler";
import { createBackup } from "./backup";

describe("backup scheduler", () => {
  const ROOT = mkdtempSync(join(tmpdir(), "amr-sched-"));
  afterEach(() => {
    // cleanup handled per test
  });

  it("disabled by default", () => {
    const prev = process.env.AMR_BACKUP_ENABLED;
    delete process.env.AMR_BACKUP_ENABLED;
    expect(backupSchedulerConfig().enabled).toBe(false);
    if (prev !== undefined) process.env.AMR_BACKUP_ENABLED = prev;
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
    // unrelated file and non-matching dir
    writeFileSync(join(dir, "decoy.txt"), "x");
    mkdirSync(join(dir, "other-dir"), { recursive: true });
    pruneBackups(dir, 2);
    const remaining = readdirSync(dir);
    const backups = remaining.filter((n: string) => BACKUP_NAME_RE.test(n));
    expect(backups.length).toBe(2);
    expect(remaining).toContain("decoy.txt");
    expect(remaining).toContain("other-dir");
  });
});