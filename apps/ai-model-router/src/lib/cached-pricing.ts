export interface DetailedUsage {
  inputTokens?: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
}

export interface DetailedRates {
  inputPer1M?: number;
  outputPer1M?: number;
  cachedInputPer1M?: number;
  cacheWritePer1M?: number;
}

export const ESTIMATED_CACHE_READ_RATIO = 0.1;

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

  rates: Required<DetailedRates>;
  ratesEstimated: boolean;
}

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
  const ratesEstimated = inputPer1M > 0 && (cachedGiven === 0 || writeGiven === 0);

  const totalInput = clean(u.inputTokens);
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
  uncachedCostUsd: number;
  actualCostUsd: number;
  savedUsd: number;
  savedShare: number;
}

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
