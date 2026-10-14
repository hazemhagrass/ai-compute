import { emptyTier, emptyTierRouter, type ModelRef, type TierEntry } from "./config-schema";
import { updateHermesConfig } from "./config-io";
import { systemOneProblems } from "./systemone";

export function setTierRouterEnabled(profileId: string, enabled: boolean): void {
  updateHermesConfig(profileId, (cfg) => {
    cfg.tier_router = { ...(cfg.tier_router ?? emptyTierRouter()), enabled };
    return cfg;
  });
}

export function setDefaultTier(profileId: string, tierName: string): void {
  updateHermesConfig(profileId, (cfg) => {
    cfg.tier_router = { ...(cfg.tier_router ?? emptyTierRouter()), default_tier: tierName };
    return cfg;
  });
}

export function setClassifierPool(profileId: string, pool: ModelRef[]): void {
  updateHermesConfig(profileId, (cfg) => {
    const tr = cfg.tier_router ?? emptyTierRouter();
    tr.classifier = { ...tr.classifier, pool };
    cfg.tier_router = tr;
    return cfg;
  });
}

export function setClassifierSettings(
  profileId: string,
  settings: { timeout_s?: number; history_turns?: number; enabled?: boolean },
): void {
  updateHermesConfig(profileId, (cfg) => {
    const tr = cfg.tier_router ?? emptyTierRouter();
    tr.classifier = { ...tr.classifier };
    if (settings.timeout_s !== undefined) tr.classifier.timeout_s = settings.timeout_s;
    if (settings.history_turns !== undefined) tr.classifier.history_turns = settings.history_turns;
    if (settings.enabled !== undefined) tr.classifier.enabled = settings.enabled;
    cfg.tier_router = tr;
    return cfg;
  });
}

export function setRouterBehavior(
  profileId: string,
  settings: { cooldown_s?: number; restore_primary?: boolean },
): void {
  updateHermesConfig(profileId, (cfg) => {
    const tr = { ...(cfg.tier_router ?? emptyTierRouter()) };
    if (settings.cooldown_s !== undefined) tr.cooldown_s = settings.cooldown_s;
    if (settings.restore_primary !== undefined) tr.restore_primary = settings.restore_primary;
    cfg.tier_router = tr;
    return cfg;
  });
}

export function setSystemOne(profileId: string, patch: Record<string, unknown>): void {
  updateHermesConfig(profileId, (cfg) => {
    const tr = cfg.tier_router ?? emptyTierRouter();
    const merged = { ...(tr.classifier.systemone ?? {}), ...patch };
    const problems = systemOneProblems(merged);
    if (problems.length > 0) throw new Error(`invalid systemone: ${problems.join("; ")}`);
    tr.classifier = { ...tr.classifier, systemone: merged };
    cfg.tier_router = tr;
    return cfg;
  });
}

export function setRoute(profileId: string, task: string, subtype: string, tierName: string): void {
  updateHermesConfig(profileId, (cfg) => {
    const tr = cfg.tier_router ?? emptyTierRouter();
    tr.routes = tr.routes ?? {};
    tr.routes[task] = { ...(tr.routes[task] ?? {}), [subtype]: tierName };
    cfg.tier_router = tr;
    return cfg;
  });
}

export function removeRoute(profileId: string, task: string, subtype: string): void {
  updateHermesConfig(profileId, (cfg) => {
    const routes = cfg.tier_router?.routes;
    if (!routes?.[task]) return cfg;
    delete routes[task][subtype];
    if (Object.keys(routes[task]).length === 0) delete routes[task];
    return cfg;
  });
}

export function upsertTier(profileId: string, name: string, patch: Partial<TierEntry>): void {
  if (!name.trim()) throw new Error("tier name is required");
  updateHermesConfig(profileId, (cfg) => {
    const tr = cfg.tier_router ?? emptyTierRouter();
    tr.tiers = tr.tiers ?? {};
    tr.tiers[name] = { ...emptyTier(), ...(tr.tiers[name] ?? {}), ...patch };
    cfg.tier_router = tr;
    return cfg;
  });
}

export function removeTier(profileId: string, name: string): void {
  updateHermesConfig(profileId, (cfg) => {
    if (cfg.tier_router?.tiers) delete cfg.tier_router.tiers[name];
    if (cfg.tier_router?.tiers) {
      for (const t of Object.values(cfg.tier_router.tiers)) {
        if (t.escalate_to === name) t.escalate_to = null;
      }
    }
    if (cfg.tier_router?.default_tier === name) {
      cfg.tier_router.default_tier = "normal";
    }
    if (cfg.tier_router?.routes) {
      for (const [task, subtypes] of Object.entries(cfg.tier_router.routes)) {
        for (const [subtype, target] of Object.entries(subtypes)) {
          if (target === name) delete subtypes[subtype];
        }
        if (Object.keys(subtypes).length === 0) delete cfg.tier_router.routes[task];
      }
    }
    return cfg;
  });
}

export function renameTier(profileId: string, oldName: string, newName: string): void {
  if (!newName.trim() || oldName === newName) return;
  updateHermesConfig(profileId, (cfg) => {
    const tiers = cfg.tier_router?.tiers;
    if (!tiers || !tiers[oldName]) return cfg;
    tiers[newName] = tiers[oldName];
    delete tiers[oldName];
    for (const t of Object.values(tiers)) {
      if (t.escalate_to === oldName) t.escalate_to = newName;
    }
    if (cfg.tier_router!.default_tier === oldName) cfg.tier_router!.default_tier = newName;
    if (cfg.tier_router?.routes) {
      for (const subtypes of Object.values(cfg.tier_router.routes)) {
        for (const [subtype, target] of Object.entries(subtypes)) {
          if (target === oldName) subtypes[subtype] = newName;
        }
      }
    }
    return cfg;
  });
}
