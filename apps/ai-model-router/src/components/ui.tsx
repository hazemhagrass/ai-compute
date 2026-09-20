"use client";

import type { ReactNode } from "react";

/* ------------------------------------------------------------------ utils */

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export function fmtUsd(n: number): string {
  if (!n) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
}

/* --------------------------------------------------------------- shells */

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-sm ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-3.5">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-tight">{title}</h3>}
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--fg-dim)]">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad" | "accent";
}) {
  const toneColor = {
    default: "var(--fg)",
    good: "var(--good)",
    warn: "var(--warn)",
    bad: "var(--bad)",
    accent: "var(--accent)",
  }[tone];
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel-2)]/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--fg-dim)]">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-xl font-semibold tabular-nums"
        style={{ color: toneColor }}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[8rem] items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-6 py-8 text-center text-sm text-[var(--fg-dim)]">
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- charts */

export interface Slice {
  label: string;
  value: number;
  sub?: string;
}

/** Donut chart with a centre total. Pure SVG, no dependency. */
export function Donut({
  data,
  total,
  centerLabel,
  centerValue,
  size = 190,
}: {
  data: Slice[];
  total?: number;
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  const sum = total ?? data.reduce((s, d) => s + d.value, 0);
  if (sum <= 0) return <Empty>No data in this range yet.</Empty>;

  const r = size / 2 - 14;
  const circ = 2 * Math.PI * r;

  // Precompute each arc's start offset so rendering stays a pure map.
  const arcs = data.reduce<
    { label: string; frac: number; len: number; offset: number }[]
  >((acc, d) => {
    const prev = acc[acc.length - 1];
    const frac = d.value / sum;
    acc.push({
      label: d.label,
      frac,
      len: frac * circ,
      offset: prev ? prev.offset + prev.len : 0,
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((a, i) => (
            <circle
              key={a.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={22}
              strokeDasharray={`${a.len} ${circ - a.len}`}
              strokeDashoffset={-a.offset}
              strokeLinecap="butt"
            >
              <title>{`${a.label}: ${fmtPct(a.frac)}`}</title>
            </circle>
          ))}
        </g>
        {(centerValue || centerLabel) && (
          <>
            <text
              x="50%"
              y="47%"
              textAnchor="middle"
              className="fill-[var(--fg)] font-mono text-lg font-semibold"
            >
              {centerValue}
            </text>
            <text
              x="50%"
              y="60%"
              textAnchor="middle"
              className="fill-[var(--fg-dim)] text-[10px] uppercase tracking-wider"
            >
              {centerLabel}
            </text>
          </>
        )}
      </svg>

      <ul className="min-w-[12rem] flex-1 space-y-1.5">
        {data.slice(0, 8).map((d, i) => (
          <li key={d.label} className="flex items-center gap-2.5 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="flex-1 truncate" title={d.label}>
              {d.label}
            </span>
            <span className="font-mono tabular-nums text-[var(--fg-muted)]">
              {fmtPct(d.value / sum)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal ranked bars — the "distribution over models" view. */
export function BarList({
  data,
  format = fmtNum,
  colorByIndex = true,
}: {
  data: Slice[];
  format?: (n: number) => string;
  colorByIndex?: boolean;
}) {
  if (!data.length) return <Empty>Nothing logged yet.</Empty>;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={d.label} className="amr-in" style={{ animationDelay: `${i * 30}ms` }}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium" title={d.label}>
              {d.label}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-[var(--fg-muted)]">
              {format(d.value)}
              {d.sub && <span className="ml-2 text-[var(--fg-dim)]">{d.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-2)]">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: `${Math.max(2, (d.value / max) * 100)}%`,
                background: colorByIndex
                  ? CHART_COLORS[i % CHART_COLORS.length]
                  : "var(--accent)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface Point {
  label: string;
  a: number;
  b?: number;
}

/** Dual-series area/line chart used for daily cost + calls. */
export function AreaChart({
  points,
  aLabel,
  bLabel,
  formatA = fmtUsd,
  formatB = fmtNum,
  height = 180,
}: {
  points: Point[];
  aLabel: string;
  bLabel?: string;
  formatA?: (n: number) => string;
  formatB?: (n: number) => string;
  height?: number;
}) {
  if (points.length < 2) return <Empty>Need at least two days of data.</Empty>;

  const w = 800;
  const h = height;
  const pad = { t: 12, r: 8, b: 22, l: 8 };
  const maxA = Math.max(...points.map((p) => p.a), 0.000001);
  const maxB = Math.max(...points.map((p) => p.b ?? 0), 1);

  const x = (i: number) =>
    pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
  const yA = (v: number) => h - pad.b - (v / maxA) * (h - pad.t - pad.b);
  const yB = (v: number) => h - pad.b - (v / maxB) * (h - pad.t - pad.b);

  const lineA = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${yA(p.a)}`).join(" ");
  const areaA = `${lineA} L${x(points.length - 1)},${h - pad.b} L${x(0)},${h - pad.b} Z`;
  const hasB = points.some((p) => typeof p.b === "number");
  const lineB = hasB
    ? points.map((p, i) => `${i ? "L" : "M"}${x(i)},${yB(p.b ?? 0)}`).join(" ")
    : "";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-2">
          <span className="h-2 w-4 rounded-full bg-[var(--accent)]" />
          {aLabel}
          <span className="font-mono text-[var(--fg-dim)]">peak {formatA(maxA)}</span>
        </span>
        {hasB && bLabel && (
          <span className="flex items-center gap-2">
            <span className="h-2 w-4 rounded-full bg-[var(--good)]" />
            {bLabel}
            <span className="font-mono text-[var(--fg-dim)]">peak {formatB(maxB)}</span>
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="amrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad.l}
            x2={w - pad.r}
            y1={pad.t + f * (h - pad.t - pad.b)}
            y2={pad.t + f * (h - pad.t - pad.b)}
            stroke="var(--border-soft)"
            strokeDasharray="3 5"
          />
        ))}

        <path d={areaA} fill="url(#amrFill)" />
        <path d={lineA} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        {hasB && (
          <path
            d={lineB}
            fill="none"
            stroke="var(--good)"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        )}

        {points.map((p, i) => (
          <circle key={p.label} cx={x(i)} cy={yA(p.a)} r="3" fill="var(--accent)">
            <title>{`${p.label} — ${formatA(p.a)}${
              hasB && bLabel ? ` · ${formatB(p.b ?? 0)} ${bLabel}` : ""
            }`}</title>
          </circle>
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[10px] text-[var(--fg-dim)]">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

/** 24-bucket activity histogram — "when do I actually use AI". */
export function HourHistogram({
  data,
}: {
  data: { hour: number; calls: number; costUsd: number }[];
}) {
  const byHour = new Map(data.map((d) => [d.hour, d]));
  const max = Math.max(...data.map((d) => d.calls), 1);
  if (!data.length) return <Empty>No calls logged yet.</Empty>;

  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]">
        {Array.from({ length: 24 }, (_, hour) => {
          const d = byHour.get(hour);
          const calls = d?.calls ?? 0;
          return (
            <div
              key={hour}
              className="group relative flex-1 rounded-t-sm transition-all duration-300"
              style={{
                height: `${Math.max(2, (calls / max) * 100)}%`,
                background: calls
                  ? "linear-gradient(180deg, var(--accent) 0%, var(--accent2) 100%)"
                  : "var(--panel-2)",
                opacity: calls ? 1 : 0.5,
              }}
            >
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-[10px] group-hover:block">
                {String(hour).padStart(2, "0")}:00 — {calls} calls ·{" "}
                {fmtUsd(d?.costUsd ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[var(--fg-dim)]">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

/** Context-window fill gauge per model. */
export function ContextGauge({
  rows,
}: {
  rows: { modelLabel: string; avgFill: number; maxFill: number; contextWindow: number }[];
}) {
  if (!rows.length) return <Empty>No context data yet.</Empty>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const tone =
          r.avgFill > 0.85 ? "var(--bad)" : r.avgFill > 0.7 ? "var(--warn)" : "var(--good)";
        return (
          <li key={r.modelLabel}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="truncate font-medium">{r.modelLabel}</span>
              <span className="font-mono tabular-nums text-[var(--fg-muted)]">
                avg {fmtPct(r.avgFill)} · peak {fmtPct(r.maxFill)} of{" "}
                {fmtNum(r.contextWindow)}
              </span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--panel-2)]">
              <div
                className="absolute inset-y-0 left-0 rounded-full opacity-35"
                style={{ width: `${r.maxFill * 100}%`, background: tone }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${r.avgFill * 100}%`, background: tone }}
              />
              {/* 70% degradation threshold marker */}
              <div
                className="absolute inset-y-0 w-px bg-[var(--fg-dim)]"
                style={{ left: "70%" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
