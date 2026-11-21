import { describe, expect, it } from "vitest";
import { parseHermesConfig } from "@/lib/hermes/config-schema";
import DEFAULT_PROFILE_TIER_ROUTER from "./default-tier-router.fixture.json";

describe("tier_router schema parity with the default profile", () => {
  it("round-trips the live default-profile block losslessly", () => {
    const parsed = parseHermesConfig({ tier_router: DEFAULT_PROFILE_TIER_ROUTER });
    const back = JSON.parse(JSON.stringify(parsed.tier_router));
    expect(back).toEqual(DEFAULT_PROFILE_TIER_ROUTER);
  });

  it("types restore_primary, routes and classifier.systemone", () => {
    const tr = parseHermesConfig({ tier_router: DEFAULT_PROFILE_TIER_ROUTER }).tier_router;
    expect(tr?.restore_primary).toBe(true);
    expect(tr?.routes).toEqual(DEFAULT_PROFILE_TIER_ROUTER.routes);
    const sysone = tr?.classifier.systemone;
    expect(sysone?.enabled).toBe(true);
    expect(sysone?.min_confidence).toBe(DEFAULT_PROFILE_TIER_ROUTER.classifier.systemone.min_confidence);
    expect(sysone?.attempt_timeout_s).toBe(DEFAULT_PROFILE_TIER_ROUTER.classifier.systemone.attempt_timeout_s);
  });

  it("round-trips optional entry keys (base_url, api_mode, api_key ref)", () => {
    const block = {
      tiers: {
        normal: {
          mode: "priority",
          pool: [{ provider: "custom", model: "m", base_url: "http://h:1/v1", api_mode: "chat_completions", api_key: "${KEY}" }],
          fallback: [],
        },
      },
    };
    const back = JSON.parse(JSON.stringify(parseHermesConfig({ tier_router: block }).tier_router));
    expect(back.tiers.normal.pool[0]).toEqual(block.tiers.normal.pool[0]);
  });

  it("keeps restore_primary and systemone optional for profiles that don't set them", () => {
    const parsed = parseHermesConfig({ tier_router: { tiers: {} } });
    expect(parsed.tier_router?.restore_primary).toBeUndefined();
    expect(parsed.tier_router?.classifier.systemone).toBeUndefined();
  });

  it("accepts weighted_round_robin tiers and per-entry weights (real Hermes profiles)", () => {
    const block = {
      tiers: {
        normal: {
          mode: "weighted_round_robin",
          pool: [
            { provider: "opencode-go", model: "glm-5.3-flash", weight: 3 },
            { provider: "ollama-go", model: "mimo-v2.6-pro", weight: 1 },
          ],
          escalate_to: null,
          fallback: [{ provider: "opencode-go", model: "glm-5.3-flash", weight: 2 }],
        },
      },
      classifier: {
        pool: [{ provider: "opencode-go", model: "glm-5.3-flash", weight: 4 }],
      },
    };
    const tr = parseHermesConfig({ tier_router: block }).tier_router;
    expect(tr?.tiers.normal.mode).toBe("weighted_round_robin");
    expect(tr?.tiers.normal.pool[0].weight).toBe(3);
    expect(tr?.tiers.normal.pool[1].weight).toBe(1);
    expect(tr?.tiers.normal.fallback[0].weight).toBe(2);
    expect(tr?.classifier.pool[0].weight).toBe(4);
  });

  it("rejects tier modes Hermes never introduced", () => {
    expect(() =>
      parseHermesConfig({ tier_router: { tiers: { normal: { mode: "random", pool: [] } } } }),
    ).toThrow();
  });
});

describe("weight coercion parity with Hermes _clean_pool", () => {
  // agent/tier_router.py _clean_pool (193-197): d["weight"] = max(1, int(e["weight"])),
  // except (TypeError, ValueError): d["weight"] = 1. An uncoercible weight must never fail
  // the profile.
  const weightOf = (weight: unknown): number | undefined =>
    parseHermesConfig({
      tier_router: { tiers: { normal: { pool: [{ provider: "p", model: "m", weight }] } } },
    }).tier_router?.tiers.normal.pool[0].weight;

  it("coerces integer strings like Python int()", () => {
    expect(weightOf("3")).toBe(3);
    expect(weightOf(" 4 ")).toBe(4);
  });

  it("clamps to 1 like max(1, int(...))", () => {
    expect(weightOf(0)).toBe(1);
    expect(weightOf(-2)).toBe(1);
    expect(weightOf(0.4)).toBe(1);
  });

  it("falls back to 1 for values Python int() rejects", () => {
    expect(weightOf("abc")).toBe(1);
    expect(weightOf("3.9")).toBe(1);
    expect(weightOf("")).toBe(1);
  });

  it("truncates floats like int()", () => {
    expect(weightOf(3.9)).toBe(3);
  });

  it("keeps undefined and null weights unset (Hermes omits the key)", () => {
    expect(weightOf(undefined)).toBeUndefined();
    expect(weightOf(null)).toBeUndefined();
  });

  it("never fails the profile for uncoercible weights", () => {
    const pool = parseHermesConfig({
      tier_router: {
        tiers: {
          normal: {
            pool: [
              { provider: "p", model: "m1", weight: "abc" },
              { provider: "p", model: "m2", weight: 0 },
              { provider: "p", model: "m3", weight: "3" },
            ],
          },
        },
      },
    }).tier_router?.tiers.normal.pool;
    expect(pool).toHaveLength(3);
    expect(pool?.map((e) => e.weight)).toEqual([1, 1, 3]);
  });
});
