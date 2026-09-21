import { beforeEach, describe, expect, it } from "vitest";

import { getDb } from "./db";
import { reconcile } from "./reconcile";

// Reconcile reads usage_events. Each test seeds only the rows it needs and
// scopes assertions to a unique provider slug so the auto-seeded catalogue
// and other tests cannot leak in.

function seedUsage(providerSlug: string, modelId: string, costUsd: number, ts: string) {
  getDb()
    .prepare(
      `INSERT INTO usage_events (provider_slug, model_id, cost_usd, ts, ok)
       VALUES (?,?,?,?,1)`,
    )
    .run(providerSlug, modelId, costUsd, ts);
}

describe("reconcile", () => {
  const P = "test-reconcile";
  beforeEach(() => {
    getDb().prepare(`DELETE FROM usage_events WHERE provider_slug = ?`).run(P);
  });

  it("matches an exact bill to computed spend with zero variance", () => {
    seedUsage(P, "gpt-x", 12.34, "2026-09-10 10:00:00");
    const r = reconcile({
      providerSlug: P,
      start: "2026-09-01",
      end: "2026-09-30",
      lines: [{ modelId: "gpt-x", billedUsd: 12.34 }],
    });
    expect(r.lines[0].varianceCents).toBe(0);
    expect(r.totalVarianceCents).toBe(0);
    expect(r.unmatchedInvoice).toEqual([]);
  });

  it("reports positive variance when the bill exceeds the estimate", () => {
    seedUsage(P, "m", 10, "2026-09-05 12:00:00");
    const r = reconcile({
      providerSlug: P,
      start: "2026-09-01",
      end: "2026-09-30",
      lines: [{ modelId: "m", billedUsd: 15 }],
    });
    expect(r.lines[0].varianceCents).toBe(500); // $5 over
    expect(r.lines[0].variancePct).toBeCloseTo(500 / 1500, 5);
  });

  it("flags invoice lines with no recorded usage as unmatched", () => {
    const r = reconcile({
      providerSlug: P,
      start: "2026-09-01",
      end: "2026-09-30",
      lines: [{ modelId: "ghost-model", billedUsd: 3 }],
    });
    expect(r.unmatchedInvoice).toEqual(["ghost-model"]);
  });

  it("flags computed spend that never made the invoice as unbilled", () => {
    seedUsage(P, "unbilled-m", 7.5, "2026-09-05 12:00:00");
    const r = reconcile({
      providerSlug: P,
      start: "2026-09-01",
      end: "2026-09-30",
      lines: [],
    });
    expect(r.lines[0].unbilled).toBe(true);
    expect(r.lines[0].computedCents).toBe(750);
    expect(r.totalVarianceCents).toBe(-750);
  });

  it("excludes usage outside the period", () => {
    seedUsage(P, "m", 5, "2026-08-31 23:00:00"); // before start
    seedUsage(P, "m", 5, "2026-10-01 01:00:00"); // after end
    seedUsage(P, "m", 5, "2026-09-15 12:00:00"); // inside
    const r = reconcile({
      providerSlug: P,
      start: "2026-09-01",
      end: "2026-09-30",
      lines: [{ modelId: "m", billedUsd: 5 }],
    });
    expect(r.lines[0].computedCents).toBe(500);
    expect(r.lines[0].varianceCents).toBe(0);
  });

  it("treats NaN and negative billed amounts as zero", () => {
    seedUsage(P, "m", 1, "2026-09-05 12:00:00");
    const r = reconcile({
      providerSlug: P,
      start: "2026-09-01",
      end: "2026-09-30",
      lines: [
        { modelId: "m", billedUsd: Number.NaN },
        { modelId: "m2", billedUsd: -5 },
      ],
    });
    expect(r.totalBilledCents).toBe(0);
  });
});
