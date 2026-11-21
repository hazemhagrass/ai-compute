import { describe, expect, it } from "vitest";

import { parseHermesConfig } from "./config-schema";
import { getRouterPreset, listRouterPresets } from "./router-presets";

describe("router presets", () => {
  it("every preset is schema-valid and round-trips losslessly", () => {
    for (const summary of listRouterPresets()) {
      const preset = getRouterPreset(summary.name)!;
      const parsed = parseHermesConfig({ tier_router: preset.tierRouter });
      const back = JSON.parse(JSON.stringify(parsed.tier_router));
      expect(back).toEqual(JSON.parse(JSON.stringify(preset.tierRouter)));
    }
  });

  it("every preset is a usable router: enabled, a real default tier, escalation targets that exist", () => {
    for (const summary of listRouterPresets()) {
      const { tierRouter } = getRouterPreset(summary.name)!;
      expect(tierRouter.enabled).toBe(true);
      const names = Object.keys(tierRouter.tiers);
      expect(names.length).toBeGreaterThanOrEqual(2);
      expect(names).toContain(tierRouter.default_tier);
      for (const tier of Object.values(tierRouter.tiers)) {
        if (tier.escalate_to !== null && tier.escalate_to !== undefined) {
          expect(names).toContain(tier.escalate_to);
        }
        expect(tier.pool.length).toBeGreaterThan(0);
      }
    }
  });

  it("presets carry no API keys or secrets", () => {
    for (const summary of listRouterPresets()) {
      expect(JSON.stringify(getRouterPreset(summary.name)!.tierRouter)).not.toContain("api_key");
      expect(JSON.stringify(getRouterPreset(summary.name)!.tierRouter)).not.toMatch(/sk-/);
    }
  });

  it("lists both presets with tier counts and looks them up by name", () => {
    const summaries = listRouterPresets();
    expect(summaries.map((p) => p.name).sort()).toEqual(["cloud-balanced", "local-first"]);
    for (const summary of summaries) {
      expect(summary.tierCount).toBe(Object.keys(getRouterPreset(summary.name)!.tierRouter.tiers).length);
      expect(summary.label.length).toBeGreaterThan(0);
      expect(summary.description.length).toBeGreaterThan(0);
    }
  });

  it("returns null for an unknown preset name", () => {
    expect(getRouterPreset("no-such-preset")).toBeNull();
  });
});
