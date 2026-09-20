import { getSetting, setSetting } from "./db";
import { listModels, updateModel } from "./repo";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_KEY = "openrouter_catalog";
const CACHE_TS_KEY = "openrouter_catalog_ts";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export interface CatalogEntry {
  id: string;
  name: string;
  contextLength: number;
  maxOutput: number;
  /** USD per 1M tokens */
  inputCost: number;
  outputCost: number;
  modalities: string[];
  supportsTools: boolean;
  supportsReasoning: boolean;
  supportsJson: boolean;
  vision: boolean;
  description: string;
}

interface OrModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
  };
  pricing?: { prompt?: string; completion?: string };
  top_provider?: { max_completion_tokens?: number | null; context_length?: number };
  supported_parameters?: string[];
}

const perMillion = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n * 1_000_000 : 0;
};

function mapEntry(m: OrModel): CatalogEntry {
  const params = m.supported_parameters ?? [];
  const inputMods = m.architecture?.input_modalities ?? [];
  return {
    id: m.id,
    name: m.name ?? m.id,
    contextLength: m.context_length ?? m.top_provider?.context_length ?? 0,
    maxOutput: m.top_provider?.max_completion_tokens ?? 0,
    inputCost: perMillion(m.pricing?.prompt),
    outputCost: perMillion(m.pricing?.completion),
    modalities: inputMods,
    supportsTools: params.includes("tools"),
    supportsReasoning: params.includes("reasoning") || params.includes("include_reasoning"),
    supportsJson: params.includes("response_format") || params.includes("structured_outputs"),
    vision: inputMods.includes("image"),
    description: (m.description ?? "").slice(0, 400),
  };
}

/** Fetch OpenRouter's public model catalogue (no API key needed). Cached in SQLite. */
export async function fetchCatalog(force = false): Promise<{
  entries: CatalogEntry[];
  cachedAt: string;
  fromCache: boolean;
}> {
  const ts = Number(getSetting(CACHE_TS_KEY, "0"));
  const fresh = Date.now() - ts < CACHE_TTL_MS;
  if (!force && fresh) {
    const raw = getSetting(CACHE_KEY, "");
    if (raw) {
      try {
        return {
          entries: JSON.parse(raw) as CatalogEntry[],
          cachedAt: new Date(ts).toISOString(),
          fromCache: true,
        };
      } catch {
        /* fall through to refetch */
      }
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`OpenRouter returned ${res.status}`);
    const json = (await res.json()) as { data?: OrModel[] };
    const entries = (json.data ?? []).map(mapEntry).sort((a, b) => a.id.localeCompare(b.id));
    setSetting(CACHE_KEY, JSON.stringify(entries));
    setSetting(CACHE_TS_KEY, String(Date.now()));
    return { entries, cachedAt: new Date().toISOString(), fromCache: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Strip vendor prefix / suffixes so `anthropic/claude-sonnet-4.6` ≈ `claude-sonnet-4-6`. */
function normalizeId(id: string): string {
  return id
    .toLowerCase()
    .split("/")
    .pop()!
    .split(":")[0]
    .replace(/[._]/g, "-")
    .replace(/-latest$|-preview$|-\d{8}$/g, "")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * OpenRouter exposes pricing variants as `id:variant`. `:batch` is roughly half
 * price but only applies to async batch jobs, and `:free` is rate-limited to
 * nothing — matching either would badly understate real interactive cost.
 * Canonical (suffix-free) listings always win; a variant is used only when no
 * canonical listing exists for that model.
 */
function variantRank(id: string): number {
  const variant = id.includes(":") ? id.split(":").pop()! : "";
  if (!variant) return 0; // canonical, best
  if (variant === "beta" || variant === "thinking") return 1;
  return 2; // batch, free, extended, floor, nitro…
}

export interface PriceMatch {
  modelRowId: number;
  label: string;
  matchedId: string;
  oldInput: number;
  oldOutput: number;
  newInput: number;
  newOutput: number;
  contextLength: number;
  changed: boolean;
}

/**
 * Match every stored model against the OpenRouter catalogue and refresh
 * pricing + context window. `apply=false` returns a dry-run preview.
 */
export async function syncPricing(apply: boolean): Promise<{
  matches: PriceMatch[];
  unmatched: string[];
  applied: number;
  catalogSize: number;
}> {
  const { entries } = await fetchCatalog();
  const index = new Map<string, CatalogEntry>();
  for (const e of entries) {
    const key = normalizeId(e.id);
    const prev = index.get(key);
    if (!prev) {
      index.set(key, e);
      continue;
    }
    const rank = variantRank(e.id);
    const prevRank = variantRank(prev.id);
    // Better variant wins outright; within the same variant tier, cheapest wins.
    if (rank < prevRank || (rank === prevRank && e.outputCost < prev.outputCost)) {
      index.set(key, e);
    }
  }

  const matches: PriceMatch[] = [];
  const unmatched: string[] = [];
  let applied = 0;

  for (const m of listModels()) {
    // Local/free models have no market price — never overwrite them.
    if (m.inputCost === 0 && m.outputCost === 0 && m.tags.includes("local")) continue;

    const hit = index.get(normalizeId(m.modelId));
    if (!hit || (hit.inputCost === 0 && hit.outputCost === 0)) {
      unmatched.push(m.modelId);
      continue;
    }

    const changed =
      Math.abs(hit.inputCost - m.inputCost) > 1e-6 ||
      Math.abs(hit.outputCost - m.outputCost) > 1e-6;

    matches.push({
      modelRowId: m.id,
      label: m.label,
      matchedId: hit.id,
      oldInput: m.inputCost,
      oldOutput: m.outputCost,
      newInput: hit.inputCost,
      newOutput: hit.outputCost,
      contextLength: hit.contextLength,
      changed,
    });

    if (apply && changed) {
      updateModel(m.id, {
        inputCost: hit.inputCost,
        outputCost: hit.outputCost,
        contextWindow: hit.contextLength || m.contextWindow,
        maxOutput: hit.maxOutput || m.maxOutput,
      });
      applied++;
    }
  }

  return { matches, unmatched, applied, catalogSize: entries.length };
}

/**
 * Cheapness is a 0-100 score derived from output price, log-scaled because
 * prices span 4 orders of magnitude ($0.02 → $75 per 1M).
 */
export function cheapnessFromPrice(outputCostPer1M: number): number {
  if (outputCostPer1M <= 0) return 100;
  const score = 100 - (Math.log10(outputCostPer1M) + 1.7) * 28;
  return Math.max(1, Math.min(100, Math.round(score)));
}

/** Recompute every model's `cheapness` score from its current price. */
export function recalcCheapness(): number {
  let n = 0;
  for (const m of listModels()) {
    const target = cheapnessFromPrice(m.outputCost);
    if (Math.abs(target - m.cheapness) >= 1) {
      updateModel(m.id, { cheapness: target });
      n++;
    }
  }
  return n;
}
