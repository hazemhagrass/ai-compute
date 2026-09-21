"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "./store";
import { Card, Empty } from "./ui";
import type { HealthReport, ProviderHealth } from "@/lib/health";
import type { Toast } from "./store";

export default function HealthPanel({
  onToast,
}: {
  onToast: (message: string, tone?: Toast["tone"]) => void;
}) {
  const [report, setReport] = useState<HealthReport | null>(null);
  // Starts true because the first probe fires on mount via the effect below.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const probe = useCallback(async () => {
    const res = await api<HealthReport>("/api/health");
    setReport(res);
    setError(null);
  }, []);

  // Probe everything on first open so the panel is never an empty shell.
  // setState only happens after the fetch resolves, never synchronously here.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await probe();
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Health check failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [probe]);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      await probe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health check failed");
    } finally {
      setLoading(false);
    }
  }, [probe]);

  return (
    <Card
      title="Provider health"
      subtitle="Every enabled provider, probed in parallel"
      action={
        <div className="flex items-center gap-3">
          {report && (
            <span className="text-xs text-[var(--fg-dim)]">
              {report.okCount}/{report.total} up
            </span>
          )}
          <button
            onClick={() => {
              void run();
              onToast("Re-checking all providers…");
            }}
            disabled={loading}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--panel-2)] disabled:opacity-50"
          >
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>
      }
    >
      {error && (
        <div className="mx-5 mt-4 rounded-xl border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-4 py-3 text-sm text-[var(--bad)]">
          {error}
        </div>
      )}
      {!report && loading ? (
        <Empty>Probing providers…</Empty>
      ) : !report ? null : report.results.length === 0 ? (
        <Empty>No enabled providers to check.</Empty>
      ) : (
        <ul className="divide-y divide-[var(--border-soft)]">
          {report.results.map((r) => (
            <HealthRow key={r.id} row={r} />
          ))}
        </ul>
      )}
      {report && (
        <footer className="border-t border-[var(--border-soft)] px-5 py-3 text-xs text-[var(--fg-dim)]">
          Checked {new Date(report.checkedAt).toLocaleTimeString()} · {report.durationMs} ms total
        </footer>
      )}
    </Card>
  );
}

function HealthRow({ row }: { row: ProviderHealth }) {
  return (
    <li className="flex items-center gap-4 px-5 py-3">
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          row.ok ? "bg-[var(--good)]" : "bg-[var(--bad)]"
        }`}
        aria-label={row.ok ? "up" : "down"}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
      <span className="font-mono text-xs text-[var(--fg-muted)]">{row.latencyMs} ms</span>
      <span className="font-mono text-xs text-[var(--fg-muted)]">
        {row.modelCount == null ? "- models" : `${row.modelCount} models`}
      </span>
      {row.error && (
        <span className="max-w-[40%] truncate text-xs text-[var(--bad)]" title={row.error}>
          {row.error}
        </span>
      )}
    </li>
  );
}
