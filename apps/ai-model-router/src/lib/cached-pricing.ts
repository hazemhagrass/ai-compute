/**
 * Detailed per-token-class cost accounting.
 *
 * `computeCost` in ./usage.ts bills every prompt token at the full input rate.
 * That overstates the bill for any provider with prompt caching, where a cache
 * read is typically a tenth of the normal input price, and it understates the
 * FIRST call of a cached conversation, where writing the cache costs a premium.
 * Both errors are invisible in a single total, so the split lives here.
 */

/** Token counts for one call. Missing fields are treated as 0. */
export interface DetailedUsage {
  /** Total prompt tokens, INCLUDING any that were served from cache. */
  inputTokens?: number;
  /** Subset of `inputTokens` that hit the cache. Billed at the cached rate. */
  cachedTokens?: number;
  /**
   * Tokens written INTO the cache. Counted separately from `inputTokens`
   * because providers report and bill them as their own line item.
   */
  cacheWriteTokens?: number;
  outputTokens?: number;
  /** Billed at the output rate: reasoning tokens are generated, not read. */
  reasoningTokens?: number;
}

/** USD per 1M tokens. Cached rates are optional and estimated when absent. */
export interface DetailedRates {
  inputPer1M?: number;
  outputPer1M?: number;
  cachedInputPer1M?: number;
  cacheWritePer1M?: number;
}

/**
 * ESTIMATE, not published fact. Most providers that document cache reads land
 * near a tenth of the input rate, so this is the least wrong default when a
 * catalogue entry omits the real number. Anything derived from it is flagged
 * via `ratesEstimated` so a caller never presents it as billed truth.
 */
export const ESTIMATED_CACHE_READ_RATIO = 0.1;

/**
 * ESTIMATE, not published fact. Populating a cache commonly costs a premium
 * over the normal input rate, which is why a first call can exceed what the
 * naive maths predicts.
 */
export const ESTIMATED_CACHE_WRITE_RATIO = 1.25;

export interface DetailedCost {
  freshInputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;

  freshInputCostUsd: number;
  cachedInputCostUsd: number;
  cacheWriteCostUsd: number;
  outputCostUsd: number;
  reasoningCostUsd: number;
  costUsd: number;

  /** Rates actually applied, after defaults and sanitising. */
  rates: Required<DetailedRates>;
  /** True when a cached or cache-write rate was derived from a ratio above. */
  ratesEstimated: boolean;
}

/**
 * A single non-finite or negative value must collapse to 0. NaN is contagious:
 * one bad rate would turn every downstream SUM() into NaN, and prior art in
 * this repo relied on `NaN || 0`, which only works by accident.
 */
function clean(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

function bill(tokens: number, per1M: number): number {
  const cost = (tokens / 1_000_000) * per1M;
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
}

export function computeDetailedCost(
  usage: DetailedUsage | null | undefined,
  rates: DetailedRates | null | undefined,
): DetailedCost {
  const u = usage ?? {};
  const r = rates ?? {};

  const inputPer1M = clean(r.inputPer1M);
  const outputPer1M = clean(r.outputPer1M);

  const cachedGiven = clean(r.cachedInputPer1M);
  const writeGiven = clean(r.cacheWritePer1M);
  const cachedInputPer1M = cachedGiven || inputPer1M * ESTIMATED_CACHE_READ_RATIO;
  const cacheWritePer1M = writeGiven || inputPer1M * ESTIMATED_CACHE_WRITE_RATIO;
  // Only flag an estimate when there is a price to estimate from; a free model
  // has nothing uncertain about it.
  const ratesEstimated = inputPer1M > 0 && (cachedGiven === 0 || writeGiven === 0);

  const totalInput = clean(u.inputTokens);
  // A provider can report more cached tokens than prompt tokens through a
  // rounding or accounting quirk; clamping keeps fresh input from going
  // negative and refunding the caller.
  const cachedTokens = Math.min(clean(u.cachedTokens), totalInput);
  const freshInputTokens = Math.max(0, totalInput - cachedTokens);
  const cacheWriteTokens = clean(u.cacheWriteTokens);
  const outputTokens = clean(u.outputTokens);
  const reasoningTokens = clean(u.reasoningTokens);

  const freshInputCostUsd = bill(freshInputTokens, inputPer1M);
  const cachedInputCostUsd = bill(cachedTokens, cachedInputPer1M);
  const cacheWriteCostUsd = bill(cacheWriteTokens, cacheWritePer1M);
  const outputCostUsd = bill(outputTokens, outputPer1M);
  const reasoningCostUsd = bill(reasoningTokens, outputPer1M);

  const costUsd =
    freshInputCostUsd +
    cachedInputCostUsd +
    cacheWriteCostUsd +
    outputCostUsd +
    reasoningCostUsd;

  return {
    freshInputTokens,
    cachedTokens,
    cacheWriteTokens,
    outputTokens,
    reasoningTokens,
    freshInputCostUsd,
    cachedInputCostUsd,
    cacheWriteCostUsd,
    outputCostUsd,
    reasoningCostUsd,
    costUsd: Number.isFinite(costUsd) ? costUsd : 0,
    rates: {
      inputPer1M,
      outputPer1M,
      cachedInputPer1M,
      cacheWritePer1M,
    },
    ratesEstimated,
  };
}

export interface CacheSavings {
  /** What the same call would have cost with no cache at all. */
  uncachedCostUsd: number;
  /** What it actually cost, cache reads and writes included. */
  actualCostUsd: number;
  /** Positive when the cache paid off. Negative on a write-heavy first call. */
  savedUsd: number;
  /** 0-1 share of the uncached bill avoided. */
  savedShare: number;
}

/**
 * The counterfactual is the same call without caching: every cached token
 * billed at the full input rate, and no cache-write line at all. Keeping the
 * write cost on the actual side is deliberate, so the first call of a cached
 * conversation honestly shows up as a loss that later calls repay.
 */
export function savingsFromCache(detailed: DetailedCost): CacheSavings {
  const cachedAtFullRate = bill(detailed.cachedTokens, detailed.rates.inputPer1M);

  const uncachedCostUsd =
    detailed.freshInputCostUsd +
    cachedAtFullRate +
    detailed.outputCostUsd +
    detailed.reasoningCostUsd;

  const actualCostUsd = Number.isFinite(detailed.costUsd) ? detailed.costUsd : 0;
  const savedUsd = uncachedCostUsd - actualCostUsd;

  return {
    uncachedCostUsd,
    actualCostUsd,
    savedUsd: Number.isFinite(savedUsd) ? savedUsd : 0,
    savedShare: uncachedCostUsd > 0 ? savedUsd / uncachedCostUsd : 0,
  };
}
