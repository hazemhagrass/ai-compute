"use client";

import { useCallback, useEffect, useState } from "react";

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
  onToast,
}: {
  onToast: (m: string, t?: "info" | "good" | "bad") => void;
}) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Awaits before any setState: a synchronous setState in an effect body
  // triggers cascading renders (React 19 compiler rule). The spinner is
  // switched on by the caller instead.
  const load = useCallback(
    async (d: number) => {
      try {
        const res = await api<{ analytics: Analytics }>(`/api/analytics?days=${d}`);
        setData(res.analytics);
      } catch (err) {
        onToast(err instanceof Error ? err.message : "Analytics failed", "bad");
      } finally {
        setLoading(false);
      }
    },
    [onToast],
  );

  useEffect(() => {
    void load(days);
  }, [days, load]);

  function pickRange(d: number) {
    setLoading(true);
    setDays(d);
  }

  if (loading && !data) {
    return (
      <Card>
        <div className="amr-pulse py-10 text-center text-sm text-[var(--fg-dim)]">
          Crunching usage…
        </div>
      </Card>
    );
  }

  if (!data) return null;
  const t = data.totals;

  if (t.calls === 0) {
    return (
      <div className="space-y-5">
        <RangePicker days={days} setDays={pickRange} />
        <Card>
          <Empty>
            No calls logged in this window yet. Run a prompt from the{" "}
            <span className="mx-1 font-medium text-[var(--fg)]">Playground</span> tab and
            everything — prompt, answer, tokens, cost — shows up here.
          </Empty>
        </Card>
      </div>
    );
  }

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
      <RangePicker days={days} setDays={pickRange} />

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
}: {
  days: number;
  setDays: (d: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
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
