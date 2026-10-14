"use client";

import { useCallback, useMemo, useState } from "react";

import {
  BudgetBlocked,
  BudgetWarning,
  budgetBlockFromValue,
  budgetWarningFrom,
} from "./BudgetBanner";
import { apiWithMeta } from "./store";
import {
  buildCompareBody,
  compareDisabledHint,
  compareReady,
  type CompareDraft,
} from "./compare.rules";

interface CompareLegResult {
  modelRowId: number;
  modelId: string;
  label: string;
  providerName: string;
  ok: boolean;
  text: string;
  error: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimated: boolean;
  costUsd: number;
}

export interface CompareResponse {
  a: CompareLegResult;
  b: CompareLegResult;
}

export function useCompareViewModel() {
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnPercent, setWarnPercent] = useState<number | null>(null);
  const [budgetBlock, setBudgetBlock] = useState<{
    id: string;
    period: string;
    limitCents: number;
    spentCents: number;
  } | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);

  const draft: CompareDraft = useMemo(
    () => ({ modelA, modelB, prompt }),
    [modelA, modelB, prompt],
  );

  const hint = useMemo(() => compareDisabledHint(draft, busy), [draft, busy]);

  const run = useCallback(async () => {
    const built = buildCompareBody(draft, busy);
    if (!built.ok) return;
    setBusy(true);
    setError(null);
    setBudgetBlock(null);
    setWarnPercent(null);
    try {
      const { data, res } = await apiWithMeta<CompareResponse>("/api/compare", {
        method: "POST",
        json: { ...built.body, system: system || undefined },
        throwOnError: false,
      });
      if (res.status === 402) {
        const block = budgetBlockFromValue(data);
        if (block) setBudgetBlock(block);
        throw new Error(
          (data as { error?: string } | null)?.error ?? "budget exceeded",
        );
      }
      if (!res.ok) {
        throw new Error(
          (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`,
        );
      }
      const warned = budgetWarningFrom(res);
      if (warned !== null) setWarnPercent(warned);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, [draft, busy, system]);

  const view = useMemo(
    () => ({
      draft,
      system,
      busy,
      error,
      hint,
      warnPercent,
      budgetBlock,
      result,
      resultReady: compareReady(draft, busy),
    }),
    [draft, system, busy, error, hint, warnPercent, budgetBlock, result],
  );

  return {
    view,
    setModelA,
    setModelB,
    setPrompt,
    setSystem,
    run,
  };
}

export { BudgetBlocked, BudgetWarning };
