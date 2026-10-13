import { describe, expect, it } from "vitest";
import { parseHermesConfig } from "@/lib/hermes/config-schema";

/**
 * Fixture mirrors the live tier_router block of the Hermes default profile
 * (~/.hermes/config.yaml), secrets api_key-redacted. Hermes reads these keys
 * in agent/tier_router.py and agent/systemone_router.py; the dashboard schema
 * must round-trip them losslessly.
 */
const DEFAULT_PROFILE_TIER_ROUTER = {
  enabled: true,
  default_tier: "normal",
  cooldown_s: 300,
  restore_primary: true,
  classifier: {
    pool: [{ provider: "custom", model: "qwen3:14b" }],
    enabled: true,
    history_turns: 4,
    timeout_s: 30,
    systemone: {
      enabled: true,
      endpoints: ["http://127.0.0.1:11434/api/chat"],
      timeout_s: 12,
      attempt_timeout_s: 8,
      min_confidence: 0.75,
    },
  },
  tiers: {
    normal: {
      mode: "round_robin",
      escalate_to: "complex",
      pool: [
        { provider: "opencode-go", model: "glm-5.3-flash" },
        { provider: "custom", model: "qwen3:14b", base_url: "http://127.0.0.1:11434" },
      ],
      fallback: [{ provider: "custom", model: "gpt-oss:20b" }],
    },
    complex: {
      mode: "priority",
      escalate_to: null,
      pool: [{ provider: "anthropic", model: "claude-fable-5-1", api_key: "***" }],
      fallback: [],
    },
  },
};

describe("tier_router schema parity with the default profile", () => {
  it("round-trips restore_primary and classifier.systemone losslessly", () => {
    const parsed = parseHermesConfig({ tier_router: DEFAULT_PROFILE_TIER_ROUTER });
    const tr = parsed.tier_router;

    expect(tr?.restore_primary).toBe(true);
    expect(tr?.classifier.systemone).toEqual(DEFAULT_PROFILE_TIER_ROUTER.classifier.systemone);

    // Re-serialize and compare against the fixture: nothing added, dropped, or mangled.
    const back = tr && JSON.parse(JSON.stringify(tr));
    expect(back).toEqual(DEFAULT_PROFILE_TIER_ROUTER);
  });

  it("types systemone with the fields Hermes actually reads", () => {
    const parsed = parseHermesConfig({ tier_router: DEFAULT_PROFILE_TIER_ROUTER });
    const sysone = parsed.tier_router?.classifier.systemone;
    expect(sysone?.enabled).toBe(true);
    expect(sysone?.min_confidence).toBe(0.75);
    expect(sysone?.attempt_timeout_s).toBe(8);
  });

  it("keeps restore_primary and systemone optional for profiles that don't set them", () => {
    const parsed = parseHermesConfig({ tier_router: { tiers: {} } });
    expect(parsed.tier_router?.restore_primary).toBeUndefined();
    expect(parsed.tier_router?.classifier.systemone).toBeUndefined();
  });
});
