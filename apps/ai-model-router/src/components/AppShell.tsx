"use client";

import { useState } from "react";

import AnalyticsPanel from "@/components/AnalyticsPanel";
import ComparePanel from "@/components/ComparePanel";
import HealthPanel from "@/components/HealthPanel";
import LogsPanel from "@/components/LogsPanel";
import ModelsPanel from "@/components/ModelsPanel";
import PlaygroundPanel from "@/components/PlaygroundPanel";
import ProvidersPanel from "@/components/ProvidersPanel";
import RouterPanel from "@/components/RouterPanel";
import { useCatalog, useToasts } from "@/components/store";
import type { InitialData } from "@/lib/server-data";

const TABS = [
  { id: "router", label: "Router", hint: "pick the right model" },
  { id: "playground", label: "Playground", hint: "run a prompt" },
  { id: "compare", label: "Compare", hint: "two models, one prompt" },
  { id: "analytics", label: "Analytics", hint: "spend & usage" },
  { id: "logs", label: "Logs", hint: "every prompt" },
  { id: "providers", label: "Providers", hint: "keys & endpoints" },
  { id: "health", label: "Health", hint: "connection status" },
  { id: "models", label: "Models", hint: "scores & prices" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AppShell({ initial }: { initial: InitialData }) {
  const [tab, setTab] = useState<TabId>("router");
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
