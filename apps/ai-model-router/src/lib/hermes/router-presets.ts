import cloudBalancedFixture from "./presets/cloud-balanced.fixture.json";
import localFirstFixture from "./presets/local-first.fixture.json";

import { parseHermesConfig, type TierRouterConfig } from "./config-schema";

export interface RouterPreset {
  name: string;
  label: string;
  description: string;
  tierRouter: TierRouterConfig;
}

export interface RouterPresetSummary {
  name: string;
  label: string;
  description: string;
  tierCount: number;
}

// Preset fixtures hold the tier_router block only, the same shape as
// default-tier-router.fixture.json. Each one is parsed through the config
// schema on load so a malformed preset fails loudly at import time instead of
// writing a broken config at request time.
function definePreset(
  name: string,
  label: string,
  description: string,
  fixture: Record<string, unknown>,
): RouterPreset {
  const tierRouter = parseHermesConfig({ tier_router: fixture }).tier_router;
  if (!tierRouter) throw new Error(`preset "${name}" has no tier_router block`);
  return { name, label, description, tierRouter };
}

const PRESETS: RouterPreset[] = [
  definePreset(
    "local-first",
    "Local-first",
    "Routes every tier to the LAN Ollama hosts only. No cloud providers, so nothing leaves the network.",
    localFirstFixture,
  ),
  definePreset(
    "cloud-balanced",
    "Cloud-balanced",
    "Cheap cloud models up front, frontier models for complex and plan work, with a five tier escalation chain.",
    cloudBalancedFixture,
  ),
];

export function listRouterPresets(): RouterPresetSummary[] {
  return PRESETS.map((p) => ({
    name: p.name,
    label: p.label,
    description: p.description,
    tierCount: Object.keys(p.tierRouter.tiers ?? {}).length,
  }));
}

export function getRouterPreset(name: string): RouterPreset | null {
  return PRESETS.find((p) => p.name === name) ?? null;
}
