/** Tests for lib/routing-policy.ts (issue #155). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, afterAll, describe, expect, it } from "vitest";

const DIR = mkdtempSync(join(tmpdir(), "amr-policy-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "policy.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

const policy = await import("./routing-policy");
const db = await import("./db");

beforeAll(() => {
  db.setSetting("routing_policy_v1", "");
});

afterAll(() => {
  rmSync(DIR, { recursive: true, force: true });
});

describe("routing policy", () => {
  it("returns the default when nothing is stored", () => {
    const p = policy.getRoutingPolicy();
    expect(p.preferLocal).toBe(true);
    expect(p.fallbackToLocal).toBe(true);
    expect(p.enforceEntitlements).toBe(true);
    expect(p.maxOutputCostPer1M).toBe(0);
  });

  it("PATCH-style merges without dropping other fields", () => {
    policy.updateRoutingPolicy({ preferLocal: false });
    policy.updateRoutingPolicy({ maxOutputCostPer1M: 15 });
    const p = policy.getRoutingPolicy();
    expect(p.preferLocal).toBe(false);
    expect(p.maxOutputCostPer1M).toBe(15);
    expect(p.enforceEntitlements).toBe(true);
  });

  it("rejects invalid patch values", () => {
    expect(() =>
      policy.updateRoutingPolicy({ maxOutputCostPer1M: -1 }),
    ).toThrow();
    expect(() =>
      policy.updateRoutingPolicy({ minContext: -50 }),
    ).toThrow();
  });

  it("returns the default when stored JSON is corrupt", () => {
    db.setSetting("routing_policy_v1", "not-json");
    const p = policy.getRoutingPolicy();
    expect(p.preferLocal).toBe(true);
  });

  it("reset restores every field to default", () => {
    policy.updateRoutingPolicy({ preferLocal: false, maxOutputCostPer1M: 40 });
    const p = policy.resetRoutingPolicy();
    expect(p.preferLocal).toBe(true);
    expect(p.maxOutputCostPer1M).toBe(0);
  });
});
