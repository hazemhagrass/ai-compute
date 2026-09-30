"use client";

import { useState } from "react";

import { api } from "./store";
import {
  AreaChart,
  BarList,
  Card,
  ContextGauge,
  Donut,
  Empty,
  HourHistogram,
  Stat,
  fmtNum,
  fmtPct,
  fmtUsd,
} from "./ui";
import type { Analytics } from "@/lib/usage";

const RANGES = [
  { days: 1, label: "24h" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
];

export default function AnalyticsPanel({
  initial,
  onToast,
}: {
  initial: Analytics;
  onToast: (m: string, t?: "info" | "good" | "bad") => void;
}) {
  // Seeded from the server render, so there is no fetch-on-mount effect and
  // no spinner on first paint. Refetching happens only when the user picks a
  // different range, from an event handler.
  const [days, setDays] = useState(initial.range.days);
  const [data, setData] = useState<Analytics>(initial);
  const [loading, setLoading] = useState(false);

  async function pickRange(d: number) {
    if (d === days) return;
    setLoading(true);
    setDays(d);
    try {
      const res = await api<{ analytics: Analytics }>(`/api/analytics?days=${d}`);
      setData(res.analytics);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Analytics failed", "bad");
    } finally {
      setLoading(false);
    }
  }

  const t = data.totals;

  return (
    <div className="space-y-5">
      <RangePicker days={days} setDays={pickRange} busy={loading} />

      {t.calls === 0 ? (
        <Card>
          <Empty>
            No calls logged in this window yet. Run a prompt from the{" "}
            <span className="mx-1 font-medium text-[var(--fg)]">Playground</span> tab and
            everything — prompt, answer, tokens, cost — shows up here.
          </Empty>
        </Card>
      ) : (
        <UsageBreakdown data={data} days={days} />
      )}

      <ReconciliationSection onToast={onToast} />
      <RecommendationHistory onToast={onToast} />
    </div>
  );
}

function UsageBreakdown({ data, days }: { data: Analytics; days: number }) {
  const t = data.totals;
  const modelSlices = data.byModel.map((b) => ({ label: b.label, value: b.costUsd }));
  const modelTokenSlices = data.byModel.map((b) => ({
    label: b.label,
    value: b.totalTokens,
  }));
  const providerSlices = data.byProvider.map((b) => ({
    label: b.label,
    value: b.costUsd,
  }));

  return (
    <div className="space-y-5">

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total spend"
          value={fmtUsd(t.costUsd)}
          sub={`${fmtUsd(t.avgCostPerCall)} per call`}
          tone="accent"
        />
        <Stat
          label="Calls"
          value={fmtNum(t.calls)}
          sub={t.errors ? `${t.errors} failed` : "no failures"}
          tone={t.errors ? "warn" : "good"}
        />
        <Stat
          label="Tokens"
          value={fmtNum(t.totalTokens)}
          sub={`${fmtNum(t.inputTokens)} in · ${fmtNum(t.outputTokens)} out`}
        />
        <Stat
          label="Avg speed"
          value={`${t.avgTokensPerSec} tok/s`}
          sub={`${fmtNum(t.avgLatencyMs)}ms avg latency`}
        />
      </div>

      {t.estimatedShare > 0.05 && (
        <p className="rounded-xl border border-[var(--warn)]/30 bg-[var(--warn)]/8 px-4 py-2.5 text-xs text-[var(--warn)]">
          {fmtPct(t.estimatedShare)} of these calls had no usage block from the provider —
          those token counts are estimated at ~4 chars/token, so cost is approximate.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Spend distribution by model"
          subtitle="where the money actually goes"
        >
          <Donut
            data={modelSlices}
            centerValue={fmtUsd(t.costUsd)}
            centerLabel={`${days}d spend`}
          />
        </Card>

        <Card title="Token distribution by model" subtitle="volume, not price">
          <Donut
            data={modelTokenSlices}
            centerValue={fmtNum(t.totalTokens)}
            centerLabel="tokens"
          />
        </Card>
      </div>

      <Card title="Daily cost & volume" subtitle="cost line, call count dashed">
        <AreaChart
          points={data.daily.map((d) => ({
            label: d.day.slice(5),
            a: d.costUsd,
            b: d.calls,
          }))}
          aLabel="cost"
          bLabel="calls"
        />
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Model leaderboard" subtitle="by calls, with cost and speed">
          <BarList
            data={data.byModel.map((b) => ({
              label: b.label,
              value: b.calls,
              sub: `${fmtUsd(b.costUsd)} · ${b.avgTokensPerSec} tok/s`,
            }))}
          />
        </Card>

        <Card title="Provider split" subtitle="cost share per vendor">
          <Donut data={providerSlices} centerValue={String(data.byProvider.length)} centerLabel="providers" />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="When you use AI" subtitle="calls per hour of day">
          <HourHistogram data={data.hourly} />
        </Card>

        <Card
          title="Context pressure"
          subtitle="marker at 70% — output quality degrades past it"
        >
          <ContextGauge rows={data.contextPressure} />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Spend by task" subtitle="which use case costs you most">
          {data.byTask.length ? (
            <BarList
              data={data.byTask.map((b) => ({
                label: b.label || b.key,
                value: b.costUsd,
                sub: `${b.calls} calls`,
              }))}
              format={fmtUsd}
            />
          ) : (
            <Empty>Tag prompts with a task in the Playground to see this split.</Empty>
          )}
        </Card>

        <Card title="Most expensive prompts" subtitle="top 10 single calls">
          {data.topPrompts.length ? (
            <ul className="space-y-2.5">
              {data.topPrompts.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-[var(--border-soft)] px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="truncate font-medium">{p.modelLabel}</span>
                    <span className="shrink-0 font-mono tabular-nums text-[var(--accent)]">
                      {fmtUsd(p.costUsd)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-[var(--fg-dim)]">
                    {p.preview || "(no prompt text)"}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-[var(--fg-dim)]">
                    {fmtNum(p.totalTokens)} tokens · {p.ts}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing logged yet.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

function RangePicker({
  days,
  setDays,
  busy,
}: {
  days: number;
  setDays: (d: number) => void;
  busy?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${busy ? "amr-pulse" : ""}`}>
      <span className="text-xs text-[var(--fg-dim)]">Range</span>
      <div className="flex rounded-lg border border-[var(--border)] p-1">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              days === r.days
                ? "bg-[var(--accent)] text-[#06070c]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Reconciliation */

interface ReconcileLineResult {
  modelId: string;
  billedCents: number;
  computedCents: number;
  varianceCents: number;
  variancePct: number | null;
  unbilled: boolean;
}

interface ReconcileResult {
  providerSlug: string;
  start: string;
  end: string;
  lines: ReconcileLineResult[];
  unmatchedInvoice: string[];
  totalBilledCents: number;
  totalComputedCents: number;
  totalVarianceCents: number;
}

/**
 * Reconcile a pasted provider invoice against computed cost (#184). The
 * backend (`src/lib/reconcile.ts`) already does the comparison; this is the
 * first UI for it — one textarea of `modelId,billedUsd` lines rather than a
 * bespoke line-item editor, since a pasted CSV/invoice export is the
 * realistic input shape.
 */
function ReconciliationSection({
  onToast,
}: {
  onToast: (m: string, t?: "info" | "good" | "bad") => void;
}) {
  const [providerSlug, setProviderSlug] = useState("");
  const [start, setStart] = useState(() =>
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [linesText, setLinesText] = useState("");
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [busy, setBusy] = useState(false);

  function parseLines(): { modelId: string; billedUsd: number }[] {
    return linesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [modelId, amount] = l.split(",").map((s) => s.trim());
        return { modelId, billedUsd: Number(amount) };
      })
      .filter((l) => l.modelId && Number.isFinite(l.billedUsd));
  }

  async function run() {
    if (!providerSlug.trim()) {
      onToast("Provider slug is required", "bad");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await api<{ reconciliation: ReconcileResult }>("/api/reconcile", {
        method: "POST",
        json: { providerSlug: providerSlug.trim(), start, end, lines: parseLines() },
      });
      setResult(res.reconciliation);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Reconciliation failed", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Invoice reconciliation"
      subtitle="paste a provider bill, compare it against computed cost"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-[var(--fg-dim)]">Provider slug</span>
          <input
            value={providerSlug}
            onChange={(e) => setProviderSlug(e.target.value)}
            placeholder="anthropic"
            className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-[var(--fg-dim)]">Start</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-[var(--fg-dim)]">End</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
          />
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="text-xs text-[var(--fg-dim)]">
          Invoice lines — one per line, <code>modelId,billedUsd</code>
        </span>
        <textarea
          value={linesText}
          onChange={(e) => setLinesText(e.target.value)}
          placeholder={"claude-sonnet-5,12.34\ngpt-5,8.90"}
          rows={4}
          className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 font-mono text-xs"
        />
      </label>

      <button
        onClick={run}
        disabled={busy}
        className="mt-3 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[#06070c] disabled:opacity-50"
      >
        {busy ? "Reconciling…" : "Reconcile"}
      </button>

      {result && (
        <div className="mt-4 space-y-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Billed" value={fmtUsd(result.totalBilledCents / 100)} />
            <Stat label="Computed" value={fmtUsd(result.totalComputedCents / 100)} />
            <Stat
              label="Variance"
              value={fmtUsd(result.totalVarianceCents / 100)}
              tone={
                Math.abs(result.totalVarianceCents) < 100
                  ? "good"
                  : result.totalVarianceCents > 0
                    ? "warn"
                    : "accent"
              }
            />
          </div>
          <table className="w-full text-xs">
            <thead className="text-[var(--fg-dim)]">
              <tr>
                <th className="py-1 text-left">Model</th>
                <th className="py-1 text-right">Billed</th>
                <th className="py-1 text-right">Computed</th>
                <th className="py-1 text-right">Variance</th>
                <th className="py-1 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l) => (
                <tr key={l.modelId} className="border-t border-[var(--border-soft)]">
                  <td className="py-1">{l.modelId}</td>
                  <td className="py-1 text-right">{fmtUsd(l.billedCents / 100)}</td>
                  <td className="py-1 text-right">{fmtUsd(l.computedCents / 100)}</td>
                  <td className="py-1 text-right">{fmtUsd(l.varianceCents / 100)}</td>
                  <td className="py-1 text-right text-[var(--warn)]">
                    {l.unbilled ? "unbilled" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.unmatchedInvoice.length > 0 && (
            <p className="text-xs text-[var(--warn)]">
              No recorded usage for: {result.unmatchedInvoice.join(", ")}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/* --------------------------------------------------------- Recommendations */

interface SavedRecommendation {
  id: number;
  ts: string;
  taskSlug: string;
  taskLabel: string;
  prompt: string;
  ranked: { modelRowId?: number; label?: string; score?: number }[];
  pickedModelRowId: number | null;
  pickedAt: string | null;
}

/**
 * Saved recommendation history (#185): `/api/recommendations` already lists
 * and lets a pick be recorded; RouterPanel only ever produces a fresh one.
 * This is the missing "what did the router say last time" view.
 */
function RecommendationHistory({
  onToast,
}: {
  onToast: (m: string, t?: "info" | "good" | "bad") => void;
}) {
  const [items, setItems] = useState<SavedRecommendation[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api<{ recommendations: SavedRecommendation[] }>(
        "/api/recommendations?limit=25",
      );
      setItems(res.recommendations);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to load history", "bad");
    } finally {
      setLoading(false);
    }
  }

  if (items === null) {
    return (
      <Card title="Recommendation history" subtitle="what the router suggested, and what you picked">
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--panel-2)] disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load history"}
        </button>
      </Card>
    );
  }

  return (
    <Card title="Recommendation history" subtitle="what the router suggested, and what you picked">
      {items.length === 0 ? (
        <Empty>No saved recommendations yet — run one from the Playground/Router tab.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {items.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-xs"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{r.taskLabel || r.taskSlug || "(ad-hoc)"}</span>
                <span className="font-mono text-[10px] text-[var(--fg-dim)]">{r.ts}</span>
              </div>
              <p className="mt-1 line-clamp-1 text-[var(--fg-dim)]">
                {r.prompt || "(no prompt text)"}
              </p>
              <p className="mt-1 text-[var(--fg-dim)]">
                {r.ranked.length} candidate(s) ranked
                {r.pickedModelRowId !== null && (
                  <span className="ml-2 text-[var(--good)]">
                    · picked model #{r.pickedModelRowId} at {r.pickedAt}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
