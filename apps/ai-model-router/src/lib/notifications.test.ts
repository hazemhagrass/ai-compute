import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { HealthReport } from "./health";

// A scratch data dir per run, so notification state (read ids) and budget
// state never touch the developer's real router.db.
const DIR = mkdtempSync(join(tmpdir(), "amr-notifications-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "notifications-test.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

vi.mock("./health", () => ({
  checkAllProviders: vi.fn(),
}));

const { getDb } = await import("./db");
const { saveBudget, deleteBudget } = await import("./budget");
const { checkAllProviders } = await import("./health");
const { getNotifications, markNotificationsRead } = await import("./notifications");

const mockHealth = vi.mocked(checkAllProviders);
const db = getDb();

beforeEach(() => {
  db.prepare("DELETE FROM usage_events").run();
  db.prepare("DELETE FROM settings WHERE key LIKE 'budget:%' OR key = 'notifications:read_ids'").run();
  mockHealth.mockReset();
  mockHealth.mockResolvedValue({
    total: 0,
    okCount: 0,
    durationMs: 0,
    results: [],
    checkedAt: new Date().toISOString(),
  } satisfies HealthReport);
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe("getNotifications", () => {
  it("is empty when no budget is near its limit and every provider is healthy", async () => {
    const feed = await getNotifications(new Date("2026-09-16T00:00:00Z"));
    expect(feed.items).toHaveLength(0);
    expect(feed.unreadCount).toBe(0);
  });

  it("surfaces a budget once it crosses a warning threshold", async () => {
    saveBudget({
      id: "notif-budget-1",
      label: "Notif test",
      period: "monthly",
      limitCents: 1000,
    });
    db.prepare(
      `INSERT INTO usage_events (provider_slug, model_id, cost_usd, ts)
       VALUES ('p', 'm', 8.50, '2026-09-16 00:00:00')`,
    ).run();

    const feed = await getNotifications(new Date("2026-09-16T01:00:00Z"));

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].kind).toBe("budget");
    expect(feed.items[0].severity).toBe("warning");
    expect(feed.unreadCount).toBe(1);

    deleteBudget("notif-budget-1");
  });

  it("ignores a provider with no API key configured (onboarding, not an outage)", async () => {
    mockHealth.mockResolvedValue({
      total: 1,
      okCount: 0,
      durationMs: 5,
      results: [
        {
          id: 1,
          name: "Provider 1",
          ok: false,
          status: null,
          latencyMs: 0,
          modelCount: null,
          error: "no API key configured",
          keyAudit: null,
        },
      ],
      checkedAt: new Date().toISOString(),
    } satisfies HealthReport);

    const feed = await getNotifications();
    expect(feed.items).toHaveLength(0);
  });

  it("surfaces a provider that has a key but is failing", async () => {
    mockHealth.mockResolvedValue({
      total: 1,
      okCount: 0,
      durationMs: 12,
      results: [
        {
          id: 2,
          name: "Provider 2",
          ok: false,
          status: 500,
          latencyMs: 12,
          modelCount: null,
          error: "connection failed",
          keyAudit: null,
        },
      ],
      checkedAt: new Date().toISOString(),
    } satisfies HealthReport);

    const feed = await getNotifications();
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].kind).toBe("provider_down");
    expect(feed.items[0].tab).toBe("health");
  });

  it("marks an item read and it stays read across subsequent calls", async () => {
    mockHealth.mockResolvedValue({
      total: 1,
      okCount: 0,
      durationMs: 5,
      results: [
        {
          id: 3,
          name: "Provider 3",
          ok: false,
          status: 500,
          latencyMs: 5,
          modelCount: null,
          error: "boom",
          keyAudit: null,
        },
      ],
      checkedAt: new Date().toISOString(),
    } satisfies HealthReport);

    const before = await getNotifications();
    expect(before.items[0].read).toBe(false);

    markNotificationsRead([before.items[0].id]);

    const after = await getNotifications();
    expect(after.items[0].read).toBe(true);
    expect(after.unreadCount).toBe(0);
  });

  it("does not error on an unknown id passed to markNotificationsRead", () => {
    expect(() => markNotificationsRead(["not-a-real-id"])).not.toThrow();
  });
});
