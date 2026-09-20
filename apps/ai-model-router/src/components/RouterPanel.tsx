"use client";

import { useMemo, useState } from "react";

import { api } from "./store";
import { Card, Empty, fmtNum, fmtUsd } from "./ui";
import type { Model, Provider, Recommendation, Scored, Task } from "@/lib/types";

const AXES = [
  "reasoning",
  "planning",
  "coding",
  "codeReview",
  "debugging",
  "longContext",
  "instruction",
  "creative",
  "math",
  "multilingual",
  "agentic",
  "extraction",
  "summarization",
  "vision",
  "speed",
  "cheapness",
  "quality",
];

export default function RouterPanel({
  providers,
  models,
  tasks,
  onToast,
  onRefresh,
}: {
  providers: Provider[];
  models: Model[];
  tasks: Task[];
  onToast: (msg: string, tone?: "info" | "good" | "bad") => void;
  onRefresh: () => void;
}) {
  const [mode, setMode] = useState<"preset" | "describe" | "manual">("preset");
  const [taskId, setTaskId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [localOnly, setLocalOnly] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [maxOutputCost, setMaxOutputCost] = useState<string>("");
  const [minContext, setMinContext] = useState<string>("");
  const [selectedProviders, setSelectedProviders] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<Recommendation | null>(null);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === taskId) ?? null,
    [tasks, taskId],
  );

  async function run() {
    setBusy(true);
    setRec(null);
    try {
      const body: Record<string, unknown> = {
        localOnly,
        useAi,
        limit: 8,
      };
      if (mode === "preset") {
        if (!taskId) {
          onToast("Pick a task first", "bad");
          setBusy(false);
          return;
        }
        body.taskId = taskId;
      } else if (mode === "describe") {
        if (!text.trim()) {
          onToast("Describe what you need", "bad");
          setBusy(false);
          return;
        }
        body.text = text;
      } else {
        const active = Object.entries(weights).filter(([, v]) => v > 0);
        if (!active.length) {
          onToast("Set at least one priority slider", "bad");
          setBusy(false);
          return;
        }
        body.text = "Manual priority selection";
        body.overrideWeights = Object.fromEntries(active);
      }

      if (Object.keys(weights).length && mode !== "manual") {
        body.overrideWeights = weights;
      }
      if (selectedProviders.length) body.providerIds = selectedProviders;
      if (maxOutputCost) body.maxOutputCost = Number(maxOutputCost);
      if (minContext) body.minContext = Number(minContext) * 1000;

      const res = await api<{ recommendation: Recommendation }>("/api/recommend", {
        method: "POST",
        json: body,
      });
      setRec(res.recommendation);
      if (!res.recommendation.ranked.length) {
        onToast("No model matched those constraints", "bad");
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Recommendation failed", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function pinWinner(modelRowId: number) {
    if (!activeTask) {
      onToast("Pinning only works with a saved task preset", "bad");
      return;
    }
    try {
      await api(`/api/tasks/${activeTask.id}`, {
        method: "PATCH",
        json: { pinnedModelId: modelRowId },
      });
      onToast("Pinned as the permanent choice for this task", "good");
      onRefresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Pin failed", "bad");
    }
  }

  async function unpin() {
    if (!activeTask) return;
    await api(`/api/tasks/${activeTask.id}`, {
      method: "PATCH",
      json: { pinnedModelId: null },
    });
    onToast("Unpinned — back to automatic scoring", "good");
    onRefresh();
  }

  const enabledModels = models.filter((m) => m.enabled).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* ------------------------------------------------ control column */}
      <div className="space-y-5">
        <Card title="What do you need a model for?">
          <div className="mb-4 flex rounded-lg border border-[var(--border)] p-1 text-xs">
            {(
              [
                ["preset", "Preset task"],
                ["describe", "Describe it"],
                ["manual", "Manual"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`flex-1 rounded-md px-3 py-2 font-medium transition-colors ${
                  mode === k
                    ? "bg-[var(--accent)] text-[#06070c]"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "preset" && (
            <div className="space-y-2 max-h-[20rem] overflow-auto pr-1">
              {tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTaskId(t.id)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                    taskId === t.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border-soft)] hover:border-[var(--border)] hover:bg-[var(--panel-2)]/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t.label}</span>
                    {t.pinnedModelId && (
                      <span className="rounded-full bg-[var(--warn)]/15 px-2 py-0.5 text-[10px] text-[var(--warn)]">
                        pinned
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--fg-dim)]">
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          )}

          {mode === "describe" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="e.g. I need to review a 4000-line Rust pull request and catch concurrency bugs, cost doesn't matter"
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--panel-2)]/60 px-3.5 py-3 text-sm outline-none placeholder:text-[var(--fg-dim)] focus:border-[var(--accent)]"
            />
          )}

          {mode === "manual" && (
            <div className="max-h-[20rem] space-y-2.5 overflow-auto pr-1">
              <p className="text-[11px] text-[var(--fg-dim)]">
                Set your own priorities. 0 = ignore, 5 = critical.
              </p>
              {AXES.map((axis) => (
                <label key={axis} className="block">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="capitalize">
                      {axis.replace(/([A-Z])/g, " $1").toLowerCase()}
                    </span>
                    <span className="font-mono text-[var(--fg-dim)]">
                      {weights[axis] ?? 0}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={weights[axis] ?? 0}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [axis]: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                </label>
              ))}
            </div>
          )}
        </Card>

        <Card title="Constraints">
          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between gap-3">
              <span>Local / offline only</span>
              <input
                type="checkbox"
                checked={localOnly}
                onChange={(e) => setLocalOnly(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>
                Ask a real model to judge
                <span className="ml-1 text-[var(--fg-dim)]">(costs tokens)</span>
              </span>
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="text-[var(--fg-muted)]">Max output $/1M tokens</span>
              <input
                value={maxOutputCost}
                onChange={(e) => setMaxOutputCost(e.target.value)}
                inputMode="decimal"
                placeholder="any"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/60 px-3 py-2 font-mono outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="text-[var(--fg-muted)]">Min context (k tokens)</span>
              <input
                value={minContext}
                onChange={(e) => setMinContext(e.target.value)}
                inputMode="numeric"
                placeholder="any"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/60 px-3 py-2 font-mono outline-none focus:border-[var(--accent)]"
              />
            </label>

            <div>
              <span className="text-[var(--fg-muted)]">Limit to providers</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {providers.map((p) => {
                  const on = selectedProviders.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() =>
                        setSelectedProviders((s) =>
                          on ? s.filter((x) => x !== p.id) : [...s, p.id],
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        on
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <button
          onClick={run}
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] px-4 py-3.5 text-sm font-semibold text-[#06070c] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Routing…" : "Recommend a model"}
        </button>
        <p className="text-center text-[11px] text-[var(--fg-dim)]">
          {enabledModels} models across {providers.length} providers
        </p>
      </div>

      {/* ------------------------------------------------- results column */}
      <div className="space-y-5">
        {!rec && (
          <Card>
            <Empty>
              Pick a task or describe your use case, then hit{" "}
              <span className="mx-1 font-medium text-[var(--fg)]">Recommend a model</span>.
            </Empty>
          </Card>
        )}

        {rec && rec.ai && (
          <Card
            title="AI verdict"
            subtitle={`judged by ${rec.ai.modelUsed}`}
            className="border-[var(--accent)]/40"
          >
            <p className="font-mono text-lg font-semibold text-[var(--accent)]">
              {rec.ai.pick}
            </p>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">{rec.ai.rationale}</p>
            {rec.ai.runnerUp && (
              <p className="mt-2 text-xs text-[var(--fg-dim)]">
                Runner-up: <span className="font-mono">{rec.ai.runnerUp}</span>
              </p>
            )}
          </Card>
        )}

        {rec && (
          <Card
            title={`Ranked for: ${rec.task.label}`}
            subtitle={
              Object.entries(rec.task.weights)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${k}×${v}`)
                .join("  ·  ") || "no weights"
            }
            action={
              activeTask?.pinnedModelId ? (
                <button
                  onClick={unpin}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--panel-2)]"
                >
                  Remove pin
                </button>
              ) : null
            }
          >
            {rec.ranked.length === 0 ? (
              <Empty>
                Nothing matched. Loosen the constraints, or add models under Providers.
              </Empty>
            ) : (
              <ol className="space-y-3">
                {rec.ranked.map((s, i) => (
                  <ResultRow
                    key={s.model.id}
                    scored={s}
                    rank={i + 1}
                    best={rec.ranked[0].score}
                    onPin={() => pinWinner(s.model.id)}
                    canPin={!!activeTask}
                  />
                ))}
              </ol>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  scored,
  rank,
  best,
  onPin,
  canPin,
}: {
  scored: Scored;
  rank: number;
  best: number;
  onPin: () => void;
  canPin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const m = scored.model;
  const rel = best > 0 ? scored.score / best : 0;

  return (
    <li
      className={`amr-in rounded-xl border p-4 transition-colors ${
        rank === 1
          ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.06]"
          : "border-[var(--border-soft)] hover:border-[var(--border)]"
      }`}
      style={{ animationDelay: `${rank * 40}ms` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                rank === 1
                  ? "bg-[var(--accent)] text-[#06070c]"
                  : "bg-[var(--panel-2)] text-[var(--fg-dim)]"
              }`}
            >
              {rank}
            </span>
            <h4 className="truncate text-sm font-semibold">{m.label}</h4>
            {scored.pinned && (
              <span className="rounded-full bg-[var(--warn)]/15 px-2 py-0.5 text-[10px] text-[var(--warn)]">
                pinned
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] text-[var(--fg-dim)]">
            {m.providerName} · {m.modelId}
          </p>
        </div>

        <div className="text-right">
          <div className="font-mono text-lg font-semibold tabular-nums text-[var(--accent)]">
            {scored.score.toFixed(1)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--fg-dim)]">
            score
          </div>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--panel-2)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] transition-[width] duration-500"
          style={{ width: `${Math.max(3, rel * 100)}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        {scored.reasons.slice(0, 5).map((r) => (
          <span
            key={r}
            className="rounded-md bg-[var(--panel-2)] px-2 py-1 text-[var(--fg-muted)]"
          >
            {r}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--fg-dim)]">
        <span>{fmtNum(m.contextWindow)} ctx</span>
        <span>
          in {fmtUsd(m.inputCost)} / out {fmtUsd(m.outputCost)} per 1M
        </span>
        {m.features.tools && <span>tools</span>}
        {m.features.vision && <span>vision</span>}
        {m.features.reasoning && <span>reasoning</span>}
        <span className="flex-1" />
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-[var(--border)] px-2 py-1 hover:bg-[var(--panel-2)]"
        >
          {open ? "Hide math" : "Why?"}
        </button>
        {canPin && (
          <button
            onClick={onPin}
            className="rounded-md border border-[var(--border)] px-2 py-1 hover:bg-[var(--panel-2)]"
          >
            Pin this
          </button>
        )}
      </div>

      {open && (
        <table className="mt-3 w-full text-[11px]">
          <thead className="text-[var(--fg-dim)]">
            <tr className="text-left">
              <th className="pb-1 font-normal">axis</th>
              <th className="pb-1 text-right font-normal">score</th>
              <th className="pb-1 text-right font-normal">weight</th>
              <th className="pb-1 text-right font-normal">points</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {[...scored.breakdown]
              .sort((a, b) => b.points - a.points)
              .map((b) => (
                <tr key={b.axis} className="border-t border-[var(--border-soft)]">
                  <td className="py-1 font-sans">{b.axis}</td>
                  <td className="py-1 text-right">{Math.round(b.value)}</td>
                  <td className="py-1 text-right text-[var(--fg-dim)]">×{b.weight}</td>
                  <td className="py-1 text-right text-[var(--accent)]">
                    {b.points.toFixed(1)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </li>
  );
}
