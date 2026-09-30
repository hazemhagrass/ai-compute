"use client";

import { useEffect, useRef, useState } from "react";

import AnalyticsPanel from "@/components/AnalyticsPanel";
import ComparePanel from "@/components/ComparePanel";
import DashboardPanel from "@/components/DashboardPanel";
import HealthPanel from "@/components/HealthPanel";
import HermesPanel from "@/components/HermesPanel";
import LogsPanel from "@/components/LogsPanel";
import ModelsPanel from "@/components/ModelsPanel";
import PlaygroundPanel from "@/components/PlaygroundPanel";
import ProvidersPanel from "@/components/ProvidersPanel";
import RouterPanel from "@/components/RouterPanel";
import SettingsPanel from "@/components/SettingsPanel";
import { api, useCatalog, useToasts } from "@/components/store";
import type { InitialData } from "@/lib/server-data";

const TABS = [
  { id: "hermes", label: "Hermes", hint: "profiles, providers & tiers" },
  { id: "router", label: "Router", hint: "pick the right model" },
  { id: "playground", label: "Playground", hint: "run a prompt" },
  { id: "compare", label: "Compare", hint: "two models, one prompt" },
  { id: "analytics", label: "Analytics", hint: "spend & usage" },
  { id: "dashboard", label: "Dashboard", hint: "drill-down tables" },
  { id: "logs", label: "Logs", hint: "every prompt" },
  { id: "providers", label: "Providers", hint: "keys & endpoints" },
  { id: "settings", label: "Settings", hint: "subs, policy, keys" },
  { id: "health", label: "Health", hint: "connection status" },
  { id: "models", label: "Models", hint: "scores & prices" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AppShell({ initial }: { initial: InitialData }) {
  const [tab, setTab] = useState<TabId>("hermes");
  const { providers, models, tasks, refreshing, error, refresh } = useCatalog({
    providers: initial.providers,
    models: initial.models,
    tasks: initial.tasks,
  });
  const { toasts, push } = useToasts();

  const keyed = providers.filter((p) => p.hasKey || p.authType === "none").length;

  return (
    <div className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            AI Model{" "}
            <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] bg-clip-text text-transparent">
              Router
            </span>
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Every provider, every key, every endpoint, and the model that actually fits
            the job.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--fg-dim)]">
          <span>
            <span className="font-mono text-[var(--fg)]">{providers.length}</span>{" "}
            providers
          </span>
          <span>
            <span className="font-mono text-[var(--fg)]">{keyed}</span> ready
          </span>
          <span>
            <span className="font-mono text-[var(--fg)]">{models.length}</span> models
          </span>
          {refreshing && <span className="amr-pulse">syncing…</span>}
          <NotificationBell onNavigate={setTab} />
        </div>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--panel)]/60 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`group shrink-0 rounded-lg px-4 py-2.5 text-left transition-colors ${
              tab === t.id
                ? "bg-[var(--accent)] text-[#06070c]"
                : "hover:bg-[var(--panel-2)]"
            }`}
          >
            <div className="text-sm font-medium">{t.label}</div>
            <div
              className={`text-[10px] ${
                tab === t.id ? "text-[#06070c]/70" : "text-[var(--fg-dim)]"
              }`}
            >
              {t.hint}
            </div>
          </button>
        ))}
      </nav>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-4 py-3 text-sm text-[var(--bad)]">
          {error}
        </div>
      )}

      <main className="amr-in">
        {tab === "hermes" && <HermesPanel onToast={push} />}
        {tab === "router" && (
          <RouterPanel
            providers={providers}
            models={models}
            tasks={tasks}
            onToast={push}
            onRefresh={refresh}
          />
        )}
        {tab === "playground" && (
          <PlaygroundPanel models={models} tasks={tasks} onToast={push} />
        )}
        {tab === "compare" && <ComparePanel models={models} />}
        {tab === "analytics" && (
          <AnalyticsPanel initial={initial.analytics} onToast={push} />
        )}
        {tab === "dashboard" && <DashboardPanel initial={initial.analytics} />}
        {tab === "logs" && (
          <LogsPanel
            providers={providers}
            models={models}
            initial={initial.logs}
            onToast={push}
          />
        )}
        {tab === "providers" && (
          <ProvidersPanel providers={providers} onToast={push} onRefresh={refresh} />
        )}
        {tab === "settings" && <SettingsPanel providers={providers} />}
        {tab === "health" && <HealthPanel onToast={push} />}
        {tab === "models" && (
          <ModelsPanel
            providers={providers}
            models={models}
            onToast={push}
            onRefresh={refresh}
          />
        )}
      </main>

      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="amr-in pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur"
            style={{
              borderColor:
                t.tone === "good"
                  ? "var(--good)"
                  : t.tone === "bad"
                    ? "var(--bad)"
                    : "var(--border)",
              background: "var(--panel)",
              color:
                t.tone === "good"
                  ? "var(--good)"
                  : t.tone === "bad"
                    ? "var(--bad)"
                    : "var(--fg)",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

interface NotificationItemDto {
  id: string;
  kind: "budget" | "provider_down";
  severity: "warning" | "bad";
  message: string;
  ts: string;
  tab: "settings" | "health";
  read: boolean;
}

interface NotificationFeedDto {
  items: NotificationItemDto[];
  unreadCount: number;
  checkedAt: string;
}

/**
 * Notification bell (#187): merges budget-threshold alerts and provider
 * outages -- both were already computed server-side but only visible if the
 * user happened to open Settings or Health at the right moment. Polls
 * because the app has no websocket/SSE transport anywhere else; 60s matches
 * the cost of a live health probe pass without hammering every provider.
 */
function NotificationBell({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const [feed, setFeed] = useState<NotificationFeedDto | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api<NotificationFeedDto>("/api/notifications");
        if (!cancelled) setFeed(res);
      } catch {
        // A failed poll must not crash the shell; the bell just stays stale
        // until the next tick.
      }
    }
    void load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function openItem(item: NotificationItemDto) {
    setOpen(false);
    onNavigate(item.tab);
    if (item.read) return;
    try {
      const res = await api<NotificationFeedDto>("/api/notifications", {
        method: "POST",
        json: { ids: [item.id] },
      });
      setFeed(res);
    } catch {
      // Read-state is best-effort; a failed mark-read just re-shows next poll.
    }
  }

  const unread = feed?.unreadCount ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg border border-[var(--border)] px-2.5 py-1.5 hover:bg-[var(--panel-2)]"
        aria-label="Notifications"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--bad)] px-1 text-[9px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-2 shadow-xl">
          {!feed || feed.items.length === 0 ? (
            <p className="px-2 py-3 text-xs text-[var(--fg-dim)]">Nothing to report.</p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {feed.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => void openItem(item)}
                    className={`block w-full rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[var(--panel-2)] ${
                      item.read ? "text-[var(--fg-dim)]" : "text-[var(--fg)]"
                    }`}
                  >
                    <span
                      className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                        item.severity === "bad" ? "bg-[var(--bad)]" : "bg-[var(--warn)]"
                      }`}
                    />
                    {item.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
