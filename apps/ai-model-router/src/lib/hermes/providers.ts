import { catalogEntryFor } from "./catalog";
import type { HermesConfig, ProviderEntry } from "./config-schema";
import { updateHermesConfig } from "./config-io";
import { envValues, setEnvValue } from "./env";
import { profilePaths } from "./paths";

export interface AddProviderInput {
  /** Config key under `providers:` (also used as the provider id for routing). */
  id: string;
  /** Catalog provider this maps to for auth (e.g. "anthropic", "custom" for self-hosted). */
  catalogId: string;
  name?: string;
  /** Required for catalogId === "custom" (self-hosted / OpenAI-compatible endpoints). */
  baseUrl?: string;
  defaultModel?: string;
  requestTimeoutSeconds?: number;
  /** Plaintext API key — written to the profile's .env under the catalog's canonical env var. */
  apiKey?: string;
}

export interface ProviderView {
  id: string;
  name: string;
  catalogId: string;
  baseUrl: string;
  defaultModel: string;
  requestTimeoutSeconds: number;
  authType: string;
  hasKey: boolean;
  envVar: string | null;
  isDefault: boolean;
  usedInFallback: boolean;
  usedInTiers: string[];
}

/**
 * Providers in config.yaml don't carry which catalog entry they authenticate
 * as — Hermes infers that from the provider id / base URL at runtime. This
 * dashboard needs it explicit to know which env var a key belongs to, so it
 * stores a hint inside the provider entry itself
 * (`providers.<id>.__amr_catalog`), an extra key Hermes's own loader ignores
 * (verified against providers.base.ProviderProfile, which only reads
 * api/request_timeout_seconds/default_model/name/api_key — anything else on
 * the entry round-trips untouched).
 */
const CATALOG_HINT_KEY = "__amr_catalog";

function inferCatalogId(id: string, entry: ProviderEntry | undefined): string {
  const hinted = (entry as Record<string, unknown> | undefined)?.[CATALOG_HINT_KEY];
  if (typeof hinted === "string" && hinted) return hinted;
  // Best-effort fallback for providers added before this dashboard existed:
  // an id matching a catalog entry (anthropic, ollama-cloud, ...) is almost
  // certainly that provider; anything else (ollama-11, ollama-launch, a
  // custom LAN name) is a self-hosted/custom endpoint, so fall back to id.
  return id;
}

function hasAnyEnvKey(envPath: string, names: string[]): boolean {
  if (!names.length) return false;
  const values = envValues(envPath);
  return names.some((n) => (values[n] ?? "").length > 0);
}

export function listProviderViews(profileId: string, config: HermesConfig): ProviderView[] {
  const fallbackIds = new Set((config.fallback_providers ?? []).map((f) => f.provider));
  const tierUsage = new Map<string, string[]>();
  for (const [tierName, tier] of Object.entries(config.tier_router?.tiers ?? {})) {
    for (const ref of [...tier.pool, ...tier.fallback]) {
      const list = tierUsage.get(ref.provider) ?? [];
      if (!list.includes(tierName)) list.push(tierName);
      tierUsage.set(ref.provider, list);
    }
  }
  for (const ref of config.tier_router?.classifier.pool ?? []) {
    const list = tierUsage.get(ref.provider) ?? [];
    if (!list.includes("classifier")) list.push("classifier");
    tierUsage.set(ref.provider, list);
  }

  const { envPath } = profilePaths(profileId);

  return Object.entries(config.providers ?? {}).map(([id, entry]) => {
    const catalogId = inferCatalogId(id, entry);
    const catalog = catalogEntryFor(catalogId);
    const envVar = catalog.envVars[0] ?? null;
    return {
      id,
      name: entry.name ?? catalog.label,
      catalogId,
      baseUrl: entry.api ?? catalog.baseUrl,
      defaultModel: entry.default_model ?? "",
      requestTimeoutSeconds: entry.request_timeout_seconds ?? 900,
      authType: catalog.authType,
      hasKey: !!entry.api_key || hasAnyEnvKey(envPath, catalog.envVars) || catalog.authType === "none",
      envVar,
      isDefault: config.model?.provider === id,
      usedInFallback: fallbackIds.has(id),
      usedInTiers: tierUsage.get(id) ?? [],
    };
  });
}

export function addProvider(profileId: string, input: AddProviderInput): void {
  const catalog = catalogEntryFor(input.catalogId);
  const { envPath } = profilePaths(profileId);

  updateHermesConfig(profileId, (cfg) => {
    cfg.providers = cfg.providers ?? {};
    cfg.providers[input.id] = {
      ...(cfg.providers[input.id] ?? {}),
      name: input.name || catalog.label,
      api: input.baseUrl || catalog.baseUrl || undefined,
      default_model: input.defaultModel || undefined,
      request_timeout_seconds: input.requestTimeoutSeconds ?? 900,
      [CATALOG_HINT_KEY]: input.catalogId,
    } as ProviderEntry;
    return cfg;
  });

  if (input.apiKey) {
    const envVar = catalog.envVars[0];
    if (envVar) {
      setEnvValue(envPath, envVar, input.apiKey);
    } else {
      // No known env var for this catalog entry (custom/self-hosted): store
      // the key directly on the provider entry, same as Hermes's own
      // `model.api_key` escape hatch for `provider: custom`.
      updateHermesConfig(profileId, (cfg) => {
        cfg.providers[input.id] = { ...cfg.providers[input.id], api_key: input.apiKey };
        return cfg;
      });
    }
  }
}

export function updateProvider(
  profileId: string,
  id: string,
  patch: Partial<Omit<AddProviderInput, "id" | "catalogId">>,
): void {
  let catalogIdForKey = id;
  updateHermesConfig(profileId, (cfg) => {
    const existing = cfg.providers?.[id];
    if (!existing) return cfg;
    catalogIdForKey = inferCatalogId(id, existing);
    cfg.providers[id] = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.baseUrl !== undefined ? { api: patch.baseUrl } : {}),
      ...(patch.defaultModel !== undefined ? { default_model: patch.defaultModel } : {}),
      ...(patch.requestTimeoutSeconds !== undefined
        ? { request_timeout_seconds: patch.requestTimeoutSeconds }
        : {}),
    };
    return cfg;
  });

  if (patch.apiKey !== undefined) {
    const catalog = catalogEntryFor(catalogIdForKey);
    const { envPath } = profilePaths(profileId);
    const envVar = catalog.envVars[0];
    if (envVar) {
      setEnvValue(envPath, envVar, patch.apiKey || null);
    } else {
      updateHermesConfig(profileId, (c) => {
        c.providers[id] = { ...c.providers[id], api_key: patch.apiKey || undefined };
        return c;
      });
    }
  }
}

export function removeProvider(profileId: string, id: string): void {
  updateHermesConfig(profileId, (cfg) => {
    if (cfg.providers) delete cfg.providers[id];
    cfg.fallback_providers = (cfg.fallback_providers ?? []).filter((f) => f.provider !== id);
    if (cfg.tier_router) {
      for (const tier of Object.values(cfg.tier_router.tiers ?? {})) {
        tier.pool = tier.pool.filter((r) => r.provider !== id);
        tier.fallback = tier.fallback.filter((r) => r.provider !== id);
      }
      cfg.tier_router.classifier.pool = cfg.tier_router.classifier.pool.filter((r) => r.provider !== id);
    }
    if (cfg.model?.provider === id) {
      // Never leave model.default pointing at a provider that no longer
      // exists — Hermes would fail every turn until the user noticed.
      cfg.model.provider = undefined;
      cfg.model.default = undefined;
    }
    return cfg;
  });
}

export function setDefaultModel(profileId: string, provider: string, model: string): void {
  updateHermesConfig(profileId, (cfg) => {
    cfg.model = { ...cfg.model, provider, default: model };
    return cfg;
  });
}
