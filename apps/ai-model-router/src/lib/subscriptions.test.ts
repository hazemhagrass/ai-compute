/** Tests for lib/subscriptions.ts (issue #153). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, afterAll, describe, expect, it } from "vitest";

const DIR = mkdtempSync(join(tmpdir(), "amr-subs-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "subs.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

const subs = await import("./subscriptions");
const repo = await import("./repo");

let providerId: number;

beforeAll(() => {
  const p = repo.createProvider({
    name: "Scratch OpenAI",
    baseUrl: "https://api.openai.com/v1",
    kind: "cloud",
    authType: "bearer",
  });
  providerId = p.id;
});

afterAll(() => {
  rmSync(DIR, { recursive: true, force: true });
});

describe("subscriptions", () => {
  it("upserts, reads, lists and deletes", () => {
    subs.upsertSubscription({
      providerId,
      tier: "pro",
      allowModels: ["gpt-4o"],
      monthlyBudget: 100,
    });
    const got = subs.getSubscription(providerId);
    expect(got?.tier).toBe("pro");
    expect(got?.allowModels).toEqual(["gpt-4o"]);
    expect(got?.monthlyBudget).toBe(100);

    subs.upsertSubscription({ providerId, tier: "enterprise" });
    expect(subs.getSubscription(providerId)?.tier).toBe("enterprise");

    expect(subs.listSubscriptions()).toHaveLength(1);
    expect(subs.deleteSubscription(providerId)).toBe(true);
    expect(subs.getSubscription(providerId)).toBeNull();
  });

  it("marks the model unreachable when no subscription exists", () => {
    const r = subs.checkEntitlement(providerId, true, "gpt-4o");
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("no-subscription");
    expect(r.explanation).toMatch(/no subscription/);
  });

  it("honours provider disabled ahead of subscription lookup", () => {
    subs.upsertSubscription({ providerId, tier: "pro" });
    const r = subs.checkEntitlement(providerId, false, "gpt-4o");
    expect(r.reason).toBe("provider-disabled");
  });

  it("denies models on the deny-list before checking the allow-list", () => {
    subs.upsertSubscription({
      providerId,
      allowModels: ["gpt-4o"],
      denyModels: ["gpt-4o"],
    });
    const r = subs.checkEntitlement(providerId, true, "gpt-4o");
    expect(r.reason).toBe("in-deny-list");
  });

  it("only enforces an allow-list when one is set", () => {
    subs.upsertSubscription({ providerId, tier: "pro", allowModels: [], denyModels: [] });
    expect(subs.checkEntitlement(providerId, true, "any-model").allowed).toBe(true);

    subs.upsertSubscription({
      providerId,
      tier: "pro",
      allowModels: ["gpt-4o"],
      denyModels: [],
    });
    expect(subs.checkEntitlement(providerId, true, "gpt-4o").allowed).toBe(true);
    expect(subs.checkEntitlement(providerId, true, "gpt-3.5").reason).toBe(
      "not-in-allow-list",
    );
  });
});
