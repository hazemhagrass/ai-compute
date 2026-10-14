"use client";

import { BudgetBlocked, BudgetWarning } from "./BudgetBanner";
import type { Model } from "@/lib/types";
import { useCompareViewModel, type CompareResponse } from "./use-compare-view-model";

export default function ComparePanel({ models }: { models: Model[] }) {
  const vm = useCompareViewModel();
  const { view } = vm;
  const enabled = models.filter((m) => m.enabled);

  return (
    <div className="space-y-2">
      {view.budgetBlock && <BudgetBlocked budget={view.budgetBlock} />}
      {view.warnPercent !== null && <BudgetWarning percent={view.warnPercent} />}

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={view.draft.modelA}
          onChange={(e) => vm.setModelA(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        >
          <option value="">Model A</option>
          {enabled.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={view.draft.modelB}
          onChange={(e) => vm.setModelB(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        >
          <option value="">Model B</option>
          {enabled.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <input
        type="text"
        value={view.draft.prompt}
        onChange={(e) => vm.setPrompt(e.target.value)}
        placeholder="Prompt to send to both"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
      />
      <input
        type="text"
        value={vm.view.system}
        onChange={(e) => vm.setSystem(e.target.value)}
        placeholder="System prompt (optional)"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={vm.run}
          disabled={view.busy || !view.resultReady}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {view.busy ? "Comparing..." : "Run"}
        </button>
        {view.hint && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{view.hint}</span>
        )}
      </div>

      {view.error && (
        <pre className="rounded-lg bg-red-50 p-3 text-xs whitespace-pre-wrap text-red-700 dark:bg-red-950 dark:text-red-300">
          {view.error}
        </pre>
      )}

      {view.result && <CompareResult result={view.result} />}
    </div>
  );
}

function CompareResult({ result }: { result: CompareResponse }) {
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {[result.a, result.b].map((leg) => (
        <div
          key={leg.modelRowId}
          className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-semibold">{leg.label}</h4>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {leg.latencyMs}ms · {leg.totalTokens.toLocaleString()} tok · $
              {leg.costUsd.toFixed(4)}
              {leg.estimated && " (est.)"}
            </span>
          </div>
          {leg.ok ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {leg.text}
            </p>
          ) : (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{leg.error}</p>
          )}
        </div>
      ))}
    </div>
  );
}
