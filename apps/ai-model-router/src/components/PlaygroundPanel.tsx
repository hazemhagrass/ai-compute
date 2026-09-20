"use client";

import { useState } from "react";

import { api } from "./store";
import { Card, fmtNum, fmtPct, fmtUsd } from "./ui";
import type { Model, Task } from "@/lib/types";
import type { UsageEvent } from "@/lib/usage";

/**
 * Run a real prompt against any configured model. Every call is logged with
 * prompt, answer, tokens, latency, and cost — which is what feeds Analytics.
 */
export default function PlaygroundPanel({
  models,
  tasks,
  onToast,
}: {
  models: Model[];
  tasks: Task[];
  onToast: (m: string, t?: "info" | "good" | "bad") => void;
}) {
  const enabled = models.filter((m) => m.enabled && !m.features.embedding);
  const [modelRowId, setModelRowId] = useState<number>(enabled[0]?.id ?? 0);
  const [taskSlug, setTaskSlug] = useState("");
  const [system, setSystem] = useState("");
  const [prompt, setPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState(2000);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; event: UsageEvent } | null>(null);

  const model = enabled.find((m) => m.id === modelRowId);

  async function run() {
    if (!modelRowId) {
      onToast("Pick a model", "bad");
      return;
    }
    if (!prompt.trim()) {
      onToast("Write a prompt", "bad");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await api<{ text: string; event: UsageEvent }>("/api/playground", {
        method: "POST",
        json: { modelRowId, prompt, system, taskSlug, maxTokens },
      });
      setResult(res);
      onToast(
        `Done — ${fmtNum(res.event.totalTokens)} tokens, ${fmtUsd(res.event.costUsd)}`,
        "good",
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Call failed", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card title="Prompt" subtitle="every run is logged with its exact cost">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
                Model
              </span>
              <select
                value={modelRowId}
                onChange={(e) => setModelRowId(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/60 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                {enabled.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.providerName} — {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
                Tag as task (optional)
              </span>
              <select
                value={taskSlug}
                onChange={(e) => setTaskSlug(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/60 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="">— none —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.slug}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
              System prompt
            </span>
            <textarea
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={2}
              placeholder="optional"
              className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/60 px-3 py-2 text-sm outline-none placeholder:text-[var(--fg-dim)] focus:border-[var(--accent)]"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
              Prompt
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              placeholder="Ask it anything…"
              className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/60 px-3 py-2 font-mono text-xs outline-none placeholder:text-[var(--fg-dim)] focus:border-[var(--accent)]"
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between text-[11px]">
              <span className="uppercase tracking-wider text-[var(--fg-dim)]">
                Max output tokens
              </span>
              <span className="font-mono text-[var(--fg-muted)]">{maxTokens}</span>
            </div>
            <input
              type="range"
              min={64}
              max={8000}
              step={64}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>

          {model && (
            <p className="text-[11px] text-[var(--fg-dim)]">
              Est. ceiling:{" "}
              <span className="font-mono text-[var(--fg-muted)]">
                {fmtUsd(
                  (prompt.length / 4 / 1_000_000) * model.inputCost +
                    (maxTokens / 1_000_000) * model.outputCost,
                )}
              </span>{" "}
              · {fmtNum(model.contextWindow)} context
            </p>
          )}

          <button
            onClick={run}
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] px-4 py-3 text-sm font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Running…" : "Send prompt"}
          </button>
        </div>
      </Card>

      <Card title="Response">
        {busy && (
          <div className="amr-pulse py-10 text-center text-sm text-[var(--fg-dim)]">
            Waiting on {model?.label}…
          </div>
        )}

        {!busy && !result && (
          <div className="py-10 text-center text-sm text-[var(--fg-dim)]">
            The answer, token counts, and exact cost show up here — and in Logs.
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Mini label="Cost" value={fmtUsd(result.event.costUsd)} accent />
              <Mini
                label="Tokens"
                value={`${fmtNum(result.event.inputTokens)}→${fmtNum(result.event.outputTokens)}`}
              />
              <Mini label="Latency" value={`${result.event.latencyMs}ms`} />
              <Mini
                label="Speed"
                value={`${result.event.tokensPerSec.toFixed(1)}/s`}
              />
            </div>

            {result.event.contextWindow > 0 && (
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-[var(--fg-muted)]">
                  <span>Context used</span>
                  <span className="font-mono">
                    {fmtPct(result.event.contextFill)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--panel-2)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${Math.max(1, result.event.contextFill * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border-soft)] bg-[var(--panel-2)]/50 px-3.5 py-3 font-mono text-[11px] leading-relaxed">
              {result.text}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel-2)]/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
        {label}
      </div>
      <div
        className="mt-0.5 font-mono text-sm font-semibold tabular-nums"
        style={{ color: accent ? "var(--accent)" : "var(--fg)" }}
      >
        {value}
      </div>
    </div>
  );
}
