"use client";

import { useCallback, useRef, useState } from "react";

import { api } from "./store";
import { Card, Empty, fmtNum, fmtPct, fmtUsd } from "./ui";
import type { Model, Provider } from "@/lib/types";
import type { UsageEvent } from "@/lib/usage";

export default function LogsPanel({
  providers,
  models,
  initial,
  onToast,
}: {
  providers: Provider[];
  models: Model[];
  initial: { events: UsageEvent[]; total: number };
  onToast: (m: string, t?: "info" | "good" | "bad") => void;
}) {
  // Seeded from the server render: no fetch-on-mount, no first-paint spinner.
  // Every refetch below is triggered by a user action, never by an effect.
  const [events, setEvents] = useState<UsageEvent[]>(initial.events);
  const [total, setTotal] = useState(initial.total);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [providerId, setProviderId] = useState<number | "all">("all");
  const [modelRowId, setModelRowId] = useState<number | "all">("all");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<UsageEvent | null>(null);

  const LIMIT = 25;

  interface Query {
    offset: number;
    q: string;
    providerId: number | "all";
    modelRowId: number | "all";
    errorsOnly: boolean;
  }

  const current = (): Query => ({ offset, q, providerId, modelRowId, errorsOnly });

  /**
   * Fetch for an explicit query rather than reading state.
   *
   * Taking the query as an argument is what lets every call site be an event
   * handler: there is no effect watching state, so no cascading render, and
   * the request always matches the values the user just chose rather than the
   * ones from the previous render.
   */
  const load = useCallback(
    async (query: Query) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(query.offset),
        });
        if (query.q) params.set("q", query.q);
        if (query.providerId !== "all")
          params.set("providerId", String(query.providerId));
        if (query.modelRowId !== "all")
          params.set("modelRowId", String(query.modelRowId));
        if (query.errorsOnly) params.set("errors", "1");

        const res = await api<{ events: UsageEvent[]; total: number }>(
          `/api/logs?${params}`,
        );
        setEvents(res.events);
        setTotal(res.total);
      } catch (err) {
        onToast(err instanceof Error ? err.message : "Log load failed", "bad");
      } finally {
        setLoading(false);
      }
    },
    [onToast],
  );

  /** A filter changed: reset to the first page and refetch. */
  function applyFilter(patch: Partial<Query>) {
    const next = { ...current(), ...patch, offset: 0 };
    setOffset(0);
    if (patch.q !== undefined) setQ(patch.q);
    if (patch.providerId !== undefined) setProviderId(patch.providerId);
    if (patch.modelRowId !== undefined) setModelRowId(patch.modelRowId);
    if (patch.errorsOnly !== undefined) setErrorsOnly(patch.errorsOnly);
    void load(next);
  }

  // Search fires per keystroke, so it is debounced; the other filters are
  // discrete choices and fire immediately.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onSearch(value: string) {
    setQ(value);
    setOffset(0);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void load({ ...current(), q: value, offset: 0 });
    }, 300);
  }

  function goToPage(next: number) {
    setOffset(next);
    void load({ ...current(), offset: next });
  }

  async function clearAll() {
    if (!confirm("Delete every logged prompt and response? This cannot be undone.")) return;
    const res = await api<{ deleted: number }>("/api/logs", { method: "DELETE" });
    onToast(`Cleared ${res.deleted} log entries`, "good");
    setOffset(0);
    void load({ ...current(), offset: 0 });
  }

  async function removeOne(id: number) {
    await api(`/api/logs/${id}`, { method: "DELETE" });
    setOpen(null);
    void load(current());
  }

  const pages = Math.ceil(total / LIMIT);
  const page = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search prompts and answers…"
          className="min-w-[14rem] flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 px-4 py-2.5 text-sm outline-none placeholder:text-[var(--fg-dim)] focus:border-[var(--accent)]"
        />
        <select
          value={providerId}
          onChange={(e) =>
            applyFilter({
              providerId: e.target.value === "all" ? "all" : Number(e.target.value),
            })
          }
          className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="all">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={modelRowId}
          onChange={(e) =>
            applyFilter({
              modelRowId: e.target.value === "all" ? "all" : Number(e.target.value),
            })
          }
          className="max-w-[14rem] rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="all">All models</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
          <input
            type="checkbox"
            checked={errorsOnly}
            onChange={(e) => applyFilter({ errorsOnly: e.target.checked })}
            className="h-4 w-4 accent-[var(--bad)]"
          />
          errors only
        </label>
        <button
          onClick={clearAll}
          className="rounded-xl border border-[var(--bad)]/40 px-4 py-2.5 text-sm text-[var(--bad)] hover:bg-[var(--bad)]/10"
        >
          Clear logs
        </button>
      </div>

      <Card
        title={`${total} logged calls`}
        subtitle="every prompt, every answer, every cent"
      >
        {loading && !events.length ? (
          <div className="amr-pulse py-8 text-center text-sm text-[var(--fg-dim)]">
            Loading…
          </div>
        ) : events.length === 0 ? (
          <Empty>Nothing logged yet — run a prompt in the Playground.</Empty>
        ) : (
          <ul className="space-y-2">
            {events.map((e, i) => (
              <li
                key={e.id}
                className="amr-in cursor-pointer rounded-xl border border-[var(--border-soft)] px-4 py-3 transition-colors hover:border-[var(--border)] hover:bg-[var(--panel-2)]/40"
                style={{ animationDelay: `${i * 20}ms` }}
                onClick={() => setOpen(e)}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: e.ok ? "var(--good)" : "var(--bad)" }}
                  />
                  <span className="font-medium">{e.modelLabel}</span>
                  <span className="text-[var(--fg-dim)]">{e.providerName}</span>
                  {e.taskLabel && (
                    <span className="rounded bg-[var(--panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--fg-dim)]">
                      {e.taskLabel}
                    </span>
                  )}
                  <span className="rounded bg-[var(--panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--fg-dim)]">
                    {e.source}
                  </span>
                  <span className="flex-1" />
                  <span className="font-mono tabular-nums text-[var(--accent)]">
                    {fmtUsd(e.costUsd)}
                  </span>
                  <span className="font-mono tabular-nums text-[var(--fg-dim)]">
                    {fmtNum(e.totalTokens)} tok
                  </span>
                  <span className="font-mono tabular-nums text-[var(--fg-dim)]">
                    {e.latencyMs}ms
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-1 text-xs text-[var(--fg-muted)]">
                  {e.prompt || "(no prompt)"}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--fg-dim)]">
                  → {e.ok ? e.response || "(empty answer)" : e.error}
                </p>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs">
            <button
              disabled={offset === 0}
              onClick={() => goToPage(Math.max(0, offset - LIMIT))}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 disabled:opacity-40 hover:bg-[var(--panel-2)]"
            >
              ← Newer
            </button>
            <span className="text-[var(--fg-dim)]">
              page {page} of {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => goToPage(offset + LIMIT)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 disabled:opacity-40 hover:bg-[var(--panel-2)]"
            >
              Older →
            </button>
          </div>
        )}
      </Card>

      {open && <LogDetail event={open} onClose={() => setOpen(null)} onDelete={removeOne} />}
    </div>
  );
}

function LogDetail({
  event: e,
  onClose,
  onDelete,
}: {
  event: UsageEvent;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="amr-in mt-8 w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">{e.modelLabel}</h3>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--fg-dim)]">
              {e.providerName} · {e.modelId} · {e.ts}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--panel-2)]"
          >
            Close
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 border-b border-[var(--border-soft)] px-5 py-4 sm:grid-cols-4">
          <Metric label="Cost" value={fmtUsd(e.costUsd)} accent />
          <Metric label="Tokens" value={`${fmtNum(e.inputTokens)} → ${fmtNum(e.outputTokens)}`} />
          <Metric label="Latency" value={`${e.latencyMs}ms`} />
          <Metric label="Throughput" value={`${e.tokensPerSec.toFixed(1)} tok/s`} />
        </div>

        {e.contextWindow > 0 && (
          <div className="border-b border-[var(--border-soft)] px-5 py-4">
            <div className="mb-1.5 flex justify-between text-[11px] text-[var(--fg-muted)]">
              <span>Context used</span>
              <span className="font-mono">
                {fmtNum(e.totalTokens)} / {fmtNum(e.contextWindow)} ({fmtPct(e.contextFill)})
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-2)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(1, e.contextFill * 100)}%`,
                  background:
                    e.contextFill > 0.85
                      ? "var(--bad)"
                      : e.contextFill > 0.7
                        ? "var(--warn)"
                        : "var(--good)",
                }}
              />
            </div>
          </div>
        )}

        <div className="max-h-[50vh] space-y-4 overflow-auto px-5 py-4">
          {e.systemPrompt && (
            <Block title="System prompt" text={e.systemPrompt} muted />
          )}
          <Block title="Prompt" text={e.prompt} />
          {e.ok ? (
            <Block title="Response" text={e.response} />
          ) : (
            <Block title="Error" text={e.error} tone="bad" />
          )}
          {e.estimated && (
            <p className="text-[11px] text-[var(--warn)]">
              Token counts estimated — this provider returned no usage block.
            </p>
          )}
        </div>

        <footer className="flex justify-end border-t border-[var(--border-soft)] px-5 py-3">
          <button
            onClick={() => onDelete(e.id)}
            className="rounded-lg border border-[var(--bad)]/40 px-3 py-1.5 text-xs text-[var(--bad)] hover:bg-[var(--bad)]/10"
          >
            Delete this entry
          </button>
        </footer>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
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

function Block({
  title,
  text,
  muted,
  tone,
}: {
  title: string;
  text: string;
  muted?: boolean;
  tone?: "bad";
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
        {title}
      </h4>
      <pre
        className="whitespace-pre-wrap break-words rounded-lg border border-[var(--border-soft)] bg-[var(--panel-2)]/50 px-3.5 py-3 font-mono text-[11px] leading-relaxed"
        style={{
          color: tone === "bad" ? "var(--bad)" : muted ? "var(--fg-dim)" : "var(--fg)",
        }}
      >
        {text || "(empty)"}
      </pre>
    </div>
  );
}
