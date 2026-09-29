import { emptyTier, emptyTierRouter, type ModelRef, type TierEntry } from "./config-schema";
import { updateHermesConfig } from "./config-io";

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
    // A tier used as another tier's escalate_to target would dangle silently;
    // clear those pointers rather than leaving a reference to nothing.
    if (cfg.tier_router?.tiers) {
      for (const t of Object.values(cfg.tier_router.tiers)) {
        if (t.escalate_to === name) t.escalate_to = null;
      }
    }
    if (cfg.tier_router?.default_tier === name) {
      cfg.tier_router.default_tier = "normal";
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
    return cfg;
  });
}
