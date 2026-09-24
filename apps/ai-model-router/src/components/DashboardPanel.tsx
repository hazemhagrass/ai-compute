"use client";

/**
 * Dashboard panel (issue #160): the drill-down view that complements the
 * chart-first AnalyticsPanel.
 *
 * Ported from the Hermes agent dashboard (MIT / Nous Research). The chart
 * layer is already covered by AnalyticsPanel, so this panel adds the piece
 * that page is missing here: sortable Daily / Model / Task tables that let
 * a user click a header and see the same numbers as the chart, ranked and
 * comparable across the window.
 *
 * Data source is the router's own /api/analytics. The Hermes dashboard
 * keeps running untouched at :8477 either way; we only imported a UI
 * pattern and the sort helper, not the data.
 */
import { useMemo, useState } from "react";

import { api } from "./store";
import type { Analytics } from "@/lib/usage";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

const RANGES = [7, 30, 90, 365] as const;

type SortDir = "asc" | "desc";

function useSort<T>(rows: T[], defaultKey: keyof T, defaultDir: SortDir = "desc") {
  const [key, setKey] = useState<keyof T>(defaultKey);
  const [dir, setDir] = useState<SortDir>(defaultDir);
  const sorted = useMemo(() => {
    const factor = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * factor;
      }
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, key, dir]);
  function toggle(k: keyof T) {
    if (k === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setKey(k);
      setDir(typeof rows[0]?.[k] === "number" ? "desc" : "asc");
    }
  }
  return { rows: sorted, key, dir, toggle };
}

function SortHeader<T>({
  label,
  sortKey,
  currentKey,
  dir,
  onToggle,
  className = "",
}: {
  label: string;
  sortKey: keyof T;
  currentKey: keyof T;
  dir: SortDir;
  onToggle: (k: keyof T) => void;
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={`flex items-center gap-1 text-left font-medium hover:text-[var(--fg)] ${
        active ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"
      } ${className}`}
    >
      {label}
      {active && <span className="text-xs">{dir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}

function DailyTable({ rows }: { rows: Analytics["daily"] }) {
  const { rows: sorted, key, dir, toggle } = useSort(rows, "day");
  if (sorted.length === 0) return <p className="text-sm text-[var(--fg-muted)]">no traffic in this window</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--panel)] text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left"><SortHeader<Analytics["daily"][number]> label="Day" sortKey="day" currentKey={key} dir={dir} onToggle={toggle} /></th>
            <th className="px-3 py-2 text-right"><SortHeader<Analytics["daily"][number]> label="Calls" sortKey="calls" currentKey={key} dir={dir} onToggle={toggle} className="ml-auto" /></th>
            <th className="px-3 py-2 text-right"><SortHeader<Analytics["daily"][number]> label="Tokens" sortKey="totalTokens" currentKey={key} dir={dir} onToggle={toggle} className="ml-auto" /></th>
            <th className="px-3 py-2 text-right"><SortHeader<Analytics["daily"][number]> label="Cost" sortKey="costUsd" currentKey={key} dir={dir} onToggle={toggle} className="ml-auto" /></th>
            <th className="px-3 py-2 text-right"><SortHeader<Analytics["daily"][number]> label="Errors" sortKey="errors" currentKey={key} dir={dir} onToggle={toggle} className="ml-auto" /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.day} className="border-t border-[var(--border)]">
              <td className="px-3 py-2 font-mono text-xs">{r.day}</td>
              <td className="px-3 py-2 text-right">{fmtNum(r.calls)}</td>
              <td className="px-3 py-2 text-right">{fmtNum(r.totalTokens)}</td>
              <td className="px-3 py-2 text-right">{fmtUsd(r.costUsd)}</td>
              <td className={`px-3 py-2 text-right ${r.errors > 0 ? "text-red-400" : ""}`}>{r.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BucketTable({
  title,
  rows,
  labelColumn,
}: {
  title: string;
  rows: Analytics["byModel"];
  labelColumn: string;
}) {
  const { rows: sorted, key, dir, toggle } = useSort(rows, "calls");
  if (sorted.length === 0) return null;
  const total = sorted.reduce((s, r) => s + r.calls, 0);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/40 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wide">
            <tr>
              <th className="py-2 text-left"><SortHeader<Analytics["byModel"][number]> label={labelColumn} sortKey="label" currentKey={key} dir={dir} onToggle={toggle} /></th>
              <th className="py-2 text-right"><SortHeader<Analytics["byModel"][number]> label="Calls" sortKey="calls" currentKey={key} dir={dir} onToggle={toggle} className="ml-auto" /></th>
              <th className="py-2 text-right"><SortHeader<Analytics["byModel"][number]> label="Tokens" sortKey="totalTokens" currentKey={key} dir={dir} onToggle={toggle} className="ml-auto" /></th>
              <th className="py-2 text-right"><SortHeader<Analytics["byModel"][number]> label="Cost" sortKey="costUsd" currentKey={key} dir={dir} onToggle={toggle} className="ml-auto" /></th>
              <th className="py-2 text-right w-20">Share</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.label} className="border-t border-[var(--border)]/50">
                <td className="py-2 pr-4 font-mono text-xs">{r.label}</td>
                <td className="py-2 text-right">{fmtNum(r.calls)}</td>
                <td className="py-2 text-right">{fmtNum(r.totalTokens)}</td>
                <td className="py-2 text-right">{fmtUsd(r.costUsd)}</td>
                <td className="py-2 text-right text-[var(--fg-muted)]">{total > 0 ? `${((r.calls / total) * 100).toFixed(0)}%` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardPanel({ initial }: { initial: Analytics | null }) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Analytics | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(next: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ analytics: Analytics }>(`/api/analytics?days=${next}`);
      setData(res.analytics);
      setDays(next);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!data) return <p className="text-sm text-[var(--fg-muted)]">no analytics yet — run something in the Playground first.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <p className="text-sm text-[var(--fg-muted)]">
            Sortable drill-down over the same {days}-day window as Analytics.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel)]/60 p-1 text-sm">
          {RANGES.map((d) => (
            <button
              key={d}
              onClick={() => load(d)}
              disabled={loading}
              className={`rounded-md px-3 py-1 transition-colors ${
                days === d
                  ? "bg-[var(--accent)] text-[#06070c]"
                  : "hover:bg-[var(--panel-2)]"
              } ${loading ? "opacity-60" : ""}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Calls" value={fmtNum(data.totals.calls)} />
        <Stat label="Tokens" value={fmtNum(data.totals.totalTokens)} />
        <Stat label="Cost" value={fmtUsd(data.totals.costUsd)} />
        <Stat
          label="Errors"
          value={String(data.totals.errors)}
          tone={data.totals.errors > 0 ? "warn" : "ok"}
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Daily</h3>
        <DailyTable rows={data.daily} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BucketTable title="By model" labelColumn="Model" rows={data.byModel} />
        <BucketTable title="By task" labelColumn="Task" rows={data.byTask} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/40 p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-400" : ""}`}>{value}</div>
    </div>
  );
}
