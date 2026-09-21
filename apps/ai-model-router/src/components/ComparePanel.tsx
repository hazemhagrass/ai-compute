"use client";

import { useMemo, useState } from "react";

import type { Model } from "@/lib/types";
import { Field, inputCls } from "./ProvidersPanel";
import { api } from "./store";
import { Card, fmtNum, fmtUsd } from "./ui";

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

interface CompareResponse {
  a: CompareLegResult;
  b: CompareLegResult;
}

function LegColumn({ title, leg }: { title: string; leg: CompareLegResult }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-2)]/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {title}: {leg.label}
          </div>
          <div className="truncate text-xs text-[var(--fg-dim)]">
            {leg.providerName} · {leg.modelId}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            leg.ok
              ? "bg-[var(--good)]/15 text-[var(--good)]"
              : "bg-[var(--bad)]/15 text-[var(--bad)]"
          }`}
        >
          {leg.ok ? "ok" : "failed"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--fg-dim)]">
        <span>
          latency{" "}
          <span className="font-mono text-[var(--fg)]">{fmtNum(leg.latencyMs)} ms</span>
        </span>
        <span>
          cost <span className="font-mono text-[var(--fg)]">{fmtUsd(leg.costUsd)}</span>
        </span>
        <span>
          tokens{" "}
          <span className="font-mono text-[var(--fg)]">
            {fmtNum(leg.inputTokens)} in / {fmtNum(leg.outputTokens)} out
          </span>
          {leg.estimated ? " (est.)" : ""}
        </span>
      </div>

      {leg.ok ? (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border-soft)] bg-[var(--panel)] p-3 text-xs">
          {leg.text || "(empty response)"}
        </pre>
      ) : (
        <div className="rounded-lg border border-[var(--bad)]/40 bg-[var(--bad)]/10 p-3 text-xs text-[var(--bad)]">
          {leg.error || "request failed"}
        </div>
      )}
    </div>
  );
}

/** Run one prompt against two models and show the tradeoff side by side. */
export default function ComparePanel({ models }: { models: Model[] }) {
  const enabled = useMemo(() => models.filter((m) => m.enabled), [models]);
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);

  const sameModel = modelA !== "" && modelA === modelB;
  const canRun = !busy && modelA !== "" && modelB !== "" && !sameModel && prompt.trim() !== "";

  const run = async () => {
    if (!canRun) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<CompareResponse>("/api/compare", {
        method: "POST",
        json: {
          modelRowIdA: Number(modelA),
          modelRowIdB: Number(modelB),
          prompt,
          system: system || undefined,
        },
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Compare"
      subtitle="Same prompt, two models, side by side. Both calls are logged to usage."
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Model A">
            <select
              className={inputCls}
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
            >
              <option value="">choose a model</option>
              {enabled.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.label} — {m.providerName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Model B">
            <select
              className={inputCls}
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
            >
              <option value="">choose a model</option>
              {enabled.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.label} — {m.providerName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="System prompt (optional)">
          <textarea
            className={inputCls}
            rows={2}
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            placeholder="You are a careful assistant."
          />
        </Field>

        <Field label="Prompt">
          <textarea
            className={inputCls}
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="The exact prompt both models receive."
          />
        </Field>

        <div className="flex items-center gap-3">
          <button
            onClick={run}
            disabled={!canRun}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[#06070c] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Comparing…" : "Run comparison"}
          </button>
          {sameModel && <span className="text-xs text-[var(--fg-dim)]">pick two different models</span>}
          {error && <span className="text-xs text-[var(--bad)]">{error}</span>}
        </div>

        {result && (
          <div className="grid gap-3 md:grid-cols-2">
            <LegColumn title="A" leg={result.a} />
            <LegColumn title="B" leg={result.b} />
          </div>
        )}
      </div>
    </Card>
  );
}
