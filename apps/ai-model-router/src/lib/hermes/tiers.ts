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

/** `tier_router.classifier.timeout_s` / `.history_turns` — tuning knobs for
 * the classifier call itself, separate from its model pool. `undefined`
 * fields are left untouched so a partial patch doesn't clobber the other. */
export function setClassifierSettings(
  profileId: string,
  settings: { timeout_s?: number; history_turns?: number },
): void {
  updateHermesConfig(profileId, (cfg) => {
    const tr = cfg.tier_router ?? emptyTierRouter();
    tr.classifier = { ...tr.classifier };
    if (settings.timeout_s !== undefined) tr.classifier.timeout_s = settings.timeout_s;
    if (settings.history_turns !== undefined) tr.classifier.history_turns = settings.history_turns;
    cfg.tier_router = tr;
    return cfg;
  });
}

/** `tier_router.routes`: a task -> subtype -> tier-name override map that
 * bypasses the classifier for a specific (task, subtype) pair. Both levels
 * are plain string keys; setting a route creates missing parent objects,
 * removing one prunes an emptied parent so the map never accumulates `{}`
 * husks. */
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
    // Same dangling-reference risk for tier_router.routes[task][subtype] ->
    // tierName entries; drop any route that pointed at the removed tier.
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
