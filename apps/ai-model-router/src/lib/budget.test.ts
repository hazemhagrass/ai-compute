import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Type-only, so it does not load the module before the env vars above are set.
import type { Budget, BudgetPeriod } from "./budget";

// A scratch data dir per run, set before the db module resolves its paths, so
// tests never read or write the developer's real router.db.
const DIR = mkdtempSync(join(tmpdir(), "amr-budget-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "budget-test.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

const { getDb } = await import("./db");
const budget = await import("./budget");

const db = getDb();

// The database auto-seeds providers, models and tasks on first open, but never
// usage_events. Clearing that one table keeps every spend assertion scoped to
// rows this file inserted. Budgets get a unique id per test so their persisted
// alert state cannot leak between cases.
beforeEach(() => {
  db.prepare("DELETE FROM usage_events").run();
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

let seq = 0;
function uniqueId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

/** Insert a usage row at an explicit UTC timestamp with an explicit cost. */
function spend(isoUtc: string, costUsd: number): void {
  db.prepare("INSERT INTO usage_events (ts, cost_usd, source) VALUES (?,?,?)").run(
    isoUtc.slice(0, 19).replace("T", " "),
    costUsd,
    "budget-test",
  );
}

function makeBudget(
  period: BudgetPeriod,
  limitCents: number,
  weekStartsOn = 1,
): Budget {
  return budget.saveBudget({
    id: uniqueId(period),
    label: "Test budget",
    period,
    limitCents,
    weekStartsOn,
  });
}

describe("money handling", () => {
  it("converts USD to integer cents without a fractional remainder", () => {
    expect(budget.usdToCents(10)).toBe(1000);
    expect(budget.usdToCents(0.07)).toBe(7);
    expect(Number.isInteger(budget.usdToCents(19.995))).toBe(true);
  });

  it("refuses a fractional limit so floats cannot enter the budget", () => {
    expect(() =>
      budget.saveBudget({ id: uniqueId("frac"), period: "daily", limitCents: 10.5 }),
    ).toThrow();
  });

  it("accumulates sub-cent calls instead of rounding each one to zero", () => {
    // 1000 calls at $0.0001 are $0.10. Rounding row by row would report $0.00,
    // which is how bulk cheap-model workloads silently vanish from a budget.
    const b = makeBudget("monthly", 1000);
    for (let i = 0; i < 1000; i++) spend("2026-09-10T12:00:00", 0.0001);

    const e = budget.evaluateBudget(db, b, new Date("2026-09-20T00:00:00Z"));

    expect(e.spentCents).toBe(10);
    expect(Number.isInteger(e.spentCents)).toBe(true);
  });

  it("keeps a long run of awkward floats exactly on the cent", () => {
    // 0.1 + 0.2 in floats is famously not 0.3. Summing as integers is.
    const b = makeBudget("monthly", 100_000);
    for (let i = 0; i < 300; i++) spend("2026-09-10T12:00:00", 0.1);
    for (let i = 0; i < 300; i++) spend("2026-09-10T12:00:00", 0.2);

    const e = budget.evaluateBudget(db, b, new Date("2026-09-20T00:00:00Z"));

    expect(e.spentCents).toBe(9000);
  });
});

describe("period boundaries (UTC)", () => {
  it("starts a monthly period on the 1st at midnight UTC", () => {
    const w = budget.periodWindow(makeBudget("monthly", 1000), new Date("2026-09-17T23:30:00Z"));

    expect(w.start).toBe("2026-09-01 00:00:00");
    expect(w.end).toBe("2026-10-01 00:00:00");
  });

  it("rolls a December monthly period into January of the next year", () => {
    const w = budget.periodWindow(makeBudget("monthly", 1000), new Date("2026-12-15T10:00:00Z"));

    expect(w.start).toBe("2026-12-01 00:00:00");
    expect(w.end).toBe("2027-01-01 00:00:00");
  });

  it("starts a weekly period on the configured weekday", () => {
    // 2026-09-23 is a Wednesday; the Monday before it is 2026-09-21.
    const w = budget.periodWindow(
      makeBudget("weekly", 1000, 1),
      new Date("2026-09-23T08:00:00Z"),
    );

    expect(w.start).toBe("2026-09-21 00:00:00");
    expect(w.end).toBe("2026-09-28 00:00:00");
  });

  it("honours a Sunday week start rather than assuming Monday", () => {
    const w = budget.periodWindow(
      makeBudget("weekly", 1000, 0),
      new Date("2026-09-23T08:00:00Z"),
    );

    expect(w.start).toBe("2026-09-20 00:00:00");
    expect(w.end).toBe("2026-09-27 00:00:00");
  });

  it("treats the exact reset instant as the new period, not the old one", () => {
    const b = makeBudget("daily", 1000);
    const w = budget.periodWindow(b, new Date("2026-09-21T00:00:00Z"));

    expect(w.start).toBe("2026-09-21 00:00:00");
    expect(w.end).toBe("2026-09-22 00:00:00");
  });
});

describe("evaluateBudget", () => {
  it("accumulates spend across calls inside one period", () => {
    const b = makeBudget("monthly", 1000);
    spend("2026-09-03T09:00:00", 1.25);

    const first = budget.evaluateBudget(db, b, new Date("2026-09-15T00:00:00Z"));
    spend("2026-09-14T09:00:00", 2.75);
    const second = budget.evaluateBudget(db, b, new Date("2026-09-15T00:00:00Z"));

    expect(first.spentCents).toBe(125);
    expect(second.spentCents).toBe(400);
    expect(second.remainingCents).toBe(600);
  });

  it("ignores spend from a neighbouring period", () => {
    const b = makeBudget("monthly", 1000);
    spend("2026-08-31T23:59:59", 5);
    spend("2026-09-05T00:00:00", 1);
    spend("2026-10-01T00:00:00", 5);

    const e = budget.evaluateBudget(db, b, new Date("2026-09-15T00:00:00Z"));

    expect(e.spentCents).toBe(100);
  });

  it("resets spend to zero after a period rollover", () => {
    const b = makeBudget("monthly", 1000);
    spend("2026-09-20T09:00:00", 4);

    const inPeriod = budget.evaluateBudget(db, b, new Date("2026-09-25T00:00:00Z"));
    const afterRollover = budget.evaluateBudget(db, b, new Date("2026-10-02T00:00:00Z"));

    expect(inPeriod.spentCents).toBe(400);
    expect(afterRollover.spentCents).toBe(0);
    expect(afterRollover.window.key).not.toBe(inPeriod.window.key);
  });

  it("projects double the spend when half the period has elapsed", () => {
    const b = makeBudget("monthly", 10_000);
    spend("2026-09-05T00:00:00", 10);

    // September has 30 days, so 2026-09-16T00:00Z is exactly halfway.
    const e = budget.evaluateBudget(db, b, new Date("2026-09-16T00:00:00Z"));

    expect(e.elapsedFraction).toBeCloseTo(0.5, 10);
    expect(e.projectedCents).toBe(2000);
  });

  it("projects a flat total once the period is fully elapsed", () => {
    const b = makeBudget("daily", 10_000);
    spend("2026-09-21T06:00:00", 3);

    const e = budget.evaluateBudget(db, b, new Date("2026-09-21T23:59:59Z"));

    expect(e.projectedCents).toBe(300);
  });

  it("warns when the burn rate projects past the limit before spend does", () => {
    const b = makeBudget("monthly", 1000);
    spend("2026-09-02T00:00:00", 4);

    const e = budget.evaluateBudget(db, b, new Date("2026-09-11T00:00:00Z"));

    expect(e.percentUsed).toBeLessThan(80);
    expect(e.projectedCents).toBeGreaterThan(b.limitCents);
    expect(e.status).toBe("warning");
  });

  it("stays ok when spend is low and the projection lands under the limit", () => {
    const b = makeBudget("monthly", 10_000);
    spend("2026-09-02T00:00:00", 5);

    const e = budget.evaluateBudget(db, b, new Date("2026-09-16T00:00:00Z"));

    expect(e.projectedCents).toBeLessThan(b.limitCents);
    expect(e.status).toBe("ok");
  });

  it("reports exceeded once spend reaches the limit exactly", () => {
    const b = makeBudget("monthly", 1000);
    spend("2026-09-02T00:00:00", 10);

    const e = budget.evaluateBudget(db, b, new Date("2026-09-16T00:00:00Z"));

    expect(e.spentCents).toBe(1000);
    expect(e.percentUsed).toBe(100);
    expect(e.remainingCents).toBe(0);
    expect(e.status).toBe("exceeded");
  });

  it("does not clamp percentUsed, so overspend stays visible", () => {
    const b = makeBudget("monthly", 1000);
    spend("2026-09-02T00:00:00", 14);

    const e = budget.evaluateBudget(db, b, new Date("2026-09-16T00:00:00Z"));

    expect(e.percentUsed).toBeCloseTo(140, 10);
    expect(e.remainingCents).toBe(-400);
  });
});

describe("threshold alerts", () => {
  it("fires each threshold exactly once as spend climbs", () => {
    const b = makeBudget("monthly", 1000);
    const at = new Date("2026-09-16T00:00:00Z");

    spend("2026-09-02T00:00:00", 5);
    const fifty = budget.checkBudget(db, b, at);

    spend("2026-09-03T00:00:00", 3);
    const eighty = budget.checkBudget(db, b, at);

    spend("2026-09-04T00:00:00", 2);
    const hundred = budget.checkBudget(db, b, at);

    expect(fifty.alerts.map((a) => a.threshold)).toEqual([50]);
    expect(eighty.alerts.map((a) => a.threshold)).toEqual([80]);
    expect(hundred.alerts.map((a) => a.threshold)).toEqual([100]);
  });

  it("does not re-fire a threshold on the next call in the same period", () => {
    const b = makeBudget("monthly", 1000);
    const at = new Date("2026-09-16T00:00:00Z");
    spend("2026-09-02T00:00:00", 6);

    const first = budget.checkBudget(db, b, at);
    const second = budget.checkBudget(db, b, at);
    const third = budget.checkBudget(db, b, at);

    expect(first.alerts).toHaveLength(1);
    expect(second.alerts).toHaveLength(0);
    expect(third.alerts).toHaveLength(0);
  });

  it("stays silent across many calls once every threshold has fired", () => {
    const b = makeBudget("monthly", 1000);
    const at = new Date("2026-09-16T00:00:00Z");
    spend("2026-09-02T00:00:00", 12);

    const first = budget.checkBudget(db, b, at);
    let later = 0;
    for (let i = 0; i < 25; i++) later += budget.checkBudget(db, b, at).alerts.length;

    expect(first.alerts.map((a) => a.threshold)).toEqual([50, 80, 100]);
    expect(later).toBe(0);
  });

  it("fires every skipped threshold at once when spend jumps straight past them", () => {
    const b = makeBudget("monthly", 1000);
    spend("2026-09-02T00:00:00", 11);

    const check = budget.checkBudget(db, b, new Date("2026-09-16T00:00:00Z"));

    expect(check.alerts.map((a) => a.threshold)).toEqual([50, 80, 100]);
    expect(check.evaluation.status).toBe("exceeded");
  });

  it("re-arms every threshold after a period rollover", () => {
    const b = makeBudget("monthly", 1000);
    spend("2026-09-02T00:00:00", 6);
    const september = budget.checkBudget(db, b, new Date("2026-09-16T00:00:00Z"));
    const septemberAgain = budget.checkBudget(db, b, new Date("2026-09-16T00:00:00Z"));

    spend("2026-10-02T00:00:00", 6);
    const october = budget.checkBudget(db, b, new Date("2026-10-16T00:00:00Z"));

    expect(september.alerts.map((a) => a.threshold)).toEqual([50]);
    expect(septemberAgain.alerts).toHaveLength(0);
    expect(october.alerts.map((a) => a.threshold)).toEqual([50]);
    expect(october.evaluation.spentCents).toBe(600);
  });

  it("records fired thresholds so they survive a fresh read", () => {
    const b = makeBudget("monthly", 1000);
    const at = new Date("2026-09-16T00:00:00Z");
    spend("2026-09-02T00:00:00", 9);

    budget.checkBudget(db, b, at);

    expect(budget.firedThresholds(b, at)).toEqual([50, 80]);
    expect(budget.firedThresholds(b, new Date("2026-10-16T00:00:00Z"))).toEqual([]);
  });

  it("lets an explicit reset re-arm alerts inside the same period", () => {
    const b = makeBudget("monthly", 1000);
    const at = new Date("2026-09-16T00:00:00Z");
    spend("2026-09-02T00:00:00", 6);

    budget.checkBudget(db, b, at);
    budget.resetBudgetAlerts(b.id);
    const again = budget.checkBudget(db, b, at);

    expect(again.alerts.map((a) => a.threshold)).toEqual([50]);
  });

  it("never alerts on a budget with no limit set", () => {
    const b = makeBudget("monthly", 0);
    spend("2026-09-02T00:00:00", 50);

    const check = budget.checkBudget(db, b, new Date("2026-09-16T00:00:00Z"));

    expect(check.alerts).toHaveLength(0);
    expect(check.evaluation.status).toBe("ok");
  });

  it("carries the spend and limit in the alert so it can be rendered", () => {
    const b = makeBudget("monthly", 2000);
    spend("2026-09-02T00:00:00", 10);

    const [alert] = budget.checkBudget(db, b, new Date("2026-09-16T00:00:00Z")).alerts;

    expect(alert.threshold).toBe(50);
    expect(alert.spentCents).toBe(1000);
    expect(alert.limitCents).toBe(2000);
    expect(alert.message).toContain("$10.00");
    expect(alert.message).toContain("$20.00");
  });
});

describe("persistence", () => {
  it("round-trips a saved budget through the settings table", () => {
    const b = makeBudget("weekly", 4200, 0);

    const loaded = budget.getBudget(b.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.limitCents).toBe(4200);
    expect(loaded?.period).toBe("weekly");
    expect(loaded?.weekStartsOn).toBe(0);
  });

  it("lists only budgets this test created and drops a deleted one", () => {
    const a = makeBudget("daily", 500);
    const c = makeBudget("monthly", 500);

    const before = budget.listBudgets().map((x) => x.id);
    budget.deleteBudget(a.id);
    const after = budget.listBudgets().map((x) => x.id);

    expect(before).toContain(a.id);
    expect(before).toContain(c.id);
    expect(after).not.toContain(a.id);
    expect(after).toContain(c.id);
    expect(budget.getBudget(a.id)).toBeNull();
  });
});
