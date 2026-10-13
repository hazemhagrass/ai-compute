import { describe, expect, it } from "vitest";
import { parseHermesConfig } from "@/lib/hermes/config-schema";
import DEFAULT_PROFILE_TIER_ROUTER from "./default-tier-router.fixture.json";

/**
 * default-tier-router.fixture.json is a verbatim snapshot of the tier_router
 * block in the Hermes default profile (~/.hermes/config.yaml). It holds no
 * credentials: tier_router resolves keys via resolve_runtime_provider, never
 * from the block. Hermes reads these keys in agent/tier_router.py and
 * agent/systemone_router.py; the dashboard schema must round-trip them.
 */
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
});
