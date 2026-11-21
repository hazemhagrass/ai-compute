import { emptyTier, emptyTierRouter, type HermesConfig, type ModelRef, type TierEntry } from "./config-schema";
import { ConfigChangeError } from "./config-errors";
import { updateHermesConfig } from "./config-io";
import { systemOneProblems } from "./systemone";

export function applyTierRouterEnabled(config: HermesConfig, enabled: boolean): HermesConfig {
  config.tier_router = { ...(config.tier_router ?? emptyTierRouter()), enabled };
  return config;
}

export function setTierRouterEnabled(profileId: string, enabled: boolean): void {
  updateHermesConfig(profileId, (cfg) => applyTierRouterEnabled(cfg, enabled));
}

export function applySetDefaultTier(config: HermesConfig, tierName: string): HermesConfig {
  const tr = config.tier_router ?? emptyTierRouter();
  if (!Object.hasOwn(tr.tiers ?? {}, tierName)) {
    throw new ConfigChangeError(400, `default_tier "${tierName}" is not an existing tier`);
  }
  config.tier_router = { ...tr, default_tier: tierName };
  return config;
}

export function setDefaultTier(profileId: string, tierName: string): void {
  updateHermesConfig(profileId, (cfg) => applySetDefaultTier(cfg, tierName));
}

export function applySetClassifierPool(config: HermesConfig, pool: ModelRef[]): HermesConfig {
  const tr = config.tier_router ?? emptyTierRouter();
  tr.classifier = { ...tr.classifier, pool };
  config.tier_router = tr;
  return config;
}

export function setClassifierPool(profileId: string, pool: ModelRef[]): void {
  updateHermesConfig(profileId, (cfg) => applySetClassifierPool(cfg, pool));
}

export function applySetClassifierSettings(
  config: HermesConfig,
  settings: { timeout_s?: number; history_turns?: number; enabled?: boolean },
): HermesConfig {
  const tr = config.tier_router ?? emptyTierRouter();
  tr.classifier = { ...tr.classifier };
  if (settings.timeout_s !== undefined) tr.classifier.timeout_s = settings.timeout_s;
  if (settings.history_turns !== undefined) tr.classifier.history_turns = settings.history_turns;
  if (settings.enabled !== undefined) tr.classifier.enabled = settings.enabled;
  config.tier_router = tr;
  return config;
}

export function setClassifierSettings(
  profileId: string,
  settings: { timeout_s?: number; history_turns?: number; enabled?: boolean },
): void {
  updateHermesConfig(profileId, (cfg) => applySetClassifierSettings(cfg, settings));
}

export function applySetRouterBehavior(
  config: HermesConfig,
  settings: { cooldown_s?: number; restore_primary?: boolean },
): HermesConfig {
  const tr = { ...(config.tier_router ?? emptyTierRouter()) };
  if (settings.cooldown_s !== undefined) tr.cooldown_s = settings.cooldown_s;
  if (settings.restore_primary !== undefined) tr.restore_primary = settings.restore_primary;
  config.tier_router = tr;
  return config;
}

export function setRouterBehavior(
  profileId: string,
  settings: { cooldown_s?: number; restore_primary?: boolean },
): void {
  updateHermesConfig(profileId, (cfg) => applySetRouterBehavior(cfg, settings));
}

export function applySetSystemOne(config: HermesConfig, patch: Record<string, unknown>): HermesConfig {
  const tr = config.tier_router ?? emptyTierRouter();
  const merged = { ...(tr.classifier.systemone ?? {}), ...patch };
  const problems = systemOneProblems(merged);
  if (problems.length > 0) throw new Error(`invalid systemone: ${problems.join("; ")}`);
  tr.classifier = { ...tr.classifier, systemone: merged };
  config.tier_router = tr;
  return config;
}

export function setSystemOne(profileId: string, patch: Record<string, unknown>): void {
  updateHermesConfig(profileId, (cfg) => applySetSystemOne(cfg, patch));
}

export function applySetRoute(config: HermesConfig, task: string, subtype: string, tierName: string): HermesConfig {
  const tr = config.tier_router ?? emptyTierRouter();
  tr.routes = tr.routes ?? {};
  tr.routes[task] = { ...(tr.routes[task] ?? {}), [subtype]: tierName };
  config.tier_router = tr;
  return config;
}

export function setRoute(profileId: string, task: string, subtype: string, tierName: string): void {
  updateHermesConfig(profileId, (cfg) => applySetRoute(cfg, task, subtype, tierName));
}

export function applyRemoveRoute(config: HermesConfig, task: string, subtype: string): HermesConfig {
  const routes = config.tier_router?.routes;
  if (!routes?.[task]) return config;
  delete routes[task][subtype];
  if (Object.keys(routes[task]).length === 0) delete routes[task];
  return config;
}

export function removeRoute(profileId: string, task: string, subtype: string): void {
  updateHermesConfig(profileId, (cfg) => applyRemoveRoute(cfg, task, subtype));
}

export function applyUpsertTier(config: HermesConfig, name: string, patch: Partial<TierEntry>): HermesConfig {
  if (!name.trim()) throw new Error("tier name is required");
  const tr = config.tier_router ?? emptyTierRouter();
  tr.tiers = tr.tiers ?? {};
  tr.tiers[name] = { ...emptyTier(), ...(tr.tiers[name] ?? {}), ...patch };
  config.tier_router = tr;
  return config;
}

export function upsertTier(profileId: string, name: string, patch: Partial<TierEntry>): void {
  updateHermesConfig(profileId, (cfg) => applyUpsertTier(cfg, name, patch));
}

export function applyRemoveTier(config: HermesConfig, name: string): HermesConfig {
  const tr = config.tier_router;
  if (!tr?.tiers || !Object.hasOwn(tr.tiers, name)) {
    throw new ConfigChangeError(404, `tier "${name}" does not exist`);
  }
  if (tr.tiers) {
    delete tr.tiers[name];
    for (const t of Object.values(tr.tiers)) {
      if (t.escalate_to === name) t.escalate_to = null;
    }
  }
  if (tr.default_tier === name) tr.default_tier = "normal";
  if (tr.routes) {
    for (const [task, subtypes] of Object.entries(tr.routes)) {
      for (const [subtype, target] of Object.entries(subtypes)) {
        if (target === name) delete subtypes[subtype];
      }
      if (Object.keys(subtypes).length === 0) delete tr.routes[task];
    }
  }
  return config;
}

export function removeTier(profileId: string, name: string): void {
  updateHermesConfig(profileId, (cfg) => applyRemoveTier(cfg, name));
}

export function applyRenameTier(config: HermesConfig, oldName: string, newName: string): HermesConfig {
  if (!newName.trim()) throw new ConfigChangeError(400, "newName is required");
  const tiers = config.tier_router?.tiers;
  if (!tiers || !Object.hasOwn(tiers, oldName)) {
    throw new ConfigChangeError(404, `tier "${oldName}" does not exist`);
  }
  if (Object.hasOwn(tiers, newName)) {
    throw new ConfigChangeError(409, `tier "${newName}" already exists`);
  }
  tiers[newName] = tiers[oldName];
  delete tiers[oldName];
  for (const t of Object.values(tiers)) {
    if (t.escalate_to === oldName) t.escalate_to = newName;
  }
  if (config.tier_router!.default_tier === oldName) config.tier_router!.default_tier = newName;
  if (config.tier_router?.routes) {
    for (const subtypes of Object.values(config.tier_router.routes)) {
      for (const [subtype, target] of Object.entries(subtypes)) {
        if (target === oldName) subtypes[subtype] = newName;
      }
    }
  }
  return config;
}

export function renameTier(profileId: string, oldName: string, newName: string): void {
  updateHermesConfig(profileId, (cfg) => applyRenameTier(cfg, oldName, newName));
}
