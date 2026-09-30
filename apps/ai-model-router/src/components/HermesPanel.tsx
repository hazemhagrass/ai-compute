"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "./store";
import { Card, Empty, fmtNum, fmtUsd } from "./ui";
import { Field, inputCls } from "./ProvidersPanel";

/* -------------------------------------------------------------- API types */

interface HermesProfileSummary {
  id: string;
  label: string;
  isDefault: boolean;
  hasConfig: boolean;
  providerCount: number;
  defaultModel: string;
  defaultProvider: string;
  tierRouterEnabled: boolean;
  tierCount: number;
}

interface HermesProviderView {
  id: string;
  name: string;
  catalogId: string;
  baseUrl: string;
  defaultModel: string;
  requestTimeoutSeconds: number;
  authType: string;
  hasKey: boolean;
  envVar: string | null;
  isDefault: boolean;
  usedInFallback: boolean;
  usedInTiers: string[];
}

interface ModelRef {
  provider: string;
  model: string;
  base_url?: string;
  timeout?: number;
}

interface TierEntry {
  mode?: "round_robin" | "priority";
  escalate_to?: string | null;
  pool: ModelRef[];
  fallback: ModelRef[];
}

interface TierRouterConfig {
  enabled: boolean;
  default_tier: string;
  cooldown_s: number;
  classifier: { pool: ModelRef[]; timeout_s?: number; history_turns?: number };
  tiers: Record<string, TierEntry>;
  routes?: Record<string, Record<string, string>>;
}

interface ModelUsageRow {
  model: string;
  billingProvider: string;
  apiCallCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
  lastSeen: number | null;
}

interface ProfileUsageSummary {
  rows: ModelUsageRow[];
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  byProvider: { provider: string; calls: number; tokens: number; costUsd: number }[];
}

const CATALOG: { id: string; label: string }[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "nous", label: "Nous" },
  { id: "openai-codex", label: "OpenAI Codex (OAuth)" },
  { id: "gemini", label: "Gemini" },
  { id: "xai", label: "xAI / Grok" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "zai", label: "Z.ai / GLM" },
  { id: "minimax", label: "MiniMax" },
  { id: "kimi-coding", label: "Kimi" },
  { id: "fireworks", label: "Fireworks" },
  { id: "novita", label: "Novita" },
  { id: "nvidia", label: "NVIDIA NIM" },
  { id: "deepinfra", label: "DeepInfra" },
  { id: "opencode-go", label: "OpenCode Go" },
  { id: "opencode-zen", label: "OpenCode Zen" },
  { id: "ollama-cloud", label: "Ollama Cloud" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "custom", label: "Custom / self-hosted (Ollama, LM Studio, vLLM…)" },
];

type Tone = "info" | "good" | "bad";

export default function HermesPanel({
  onToast,
}: {
  onToast: (msg: string, tone?: Tone) => void;
}) {
  const [profiles, setProfiles] = useState<HermesProfileSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [providers, setProviders] = useState<HermesProviderView[] | null>(null);
  const [tierRouter, setTierRouter] = useState<TierRouterConfig | null>(null);
  const [usage, setUsage] = useState<ProfileUsageSummary | null>(null);
  const [tab, setTab] = useState<"providers" | "router" | "aliases" | "usage">("providers");
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);

  const loadProfiles = useCallback(async () => {
    const res = await api<{ profiles: HermesProfileSummary[] }>("/api/hermes/profiles");
    setProfiles(res.profiles);
    setActiveId((cur) => cur ?? res.profiles[0]?.id ?? null);
  }, []);

  const loadProfileData = useCallback(async (id: string) => {
    const [p, t, u] = await Promise.all([
      api<{ providers: HermesProviderView[] }>(`/api/hermes/profiles/${id}/providers`),
      api<{ tierRouter: TierRouterConfig | null }>(`/api/hermes/profiles/${id}/tiers`),
      api<{ usage: ProfileUsageSummary }>(`/api/hermes/profiles/${id}/usage`),
    ]);
    setProviders(p.providers);
    setTierRouter(t.tierRouter);
    setUsage(u.usage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadProfiles();
      } catch (err) {
        if (!cancelled) onToast(err instanceof Error ? err.message : "Failed to load profiles", "bad");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    void (async () => {
      try {
        await loadProfileData(activeId);
      } catch (err) {
        if (!cancelled) onToast(err instanceof Error ? err.message : "Failed to load profile", "bad");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, loadProfileData, onToast]);

  const refresh = useCallback(() => {
    if (activeId) loadProfileData(activeId).catch(() => {});
    loadProfiles().catch(() => {});
  }, [activeId, loadProfileData, loadProfiles]);

  const activeProfile = profiles?.find((p) => p.id === activeId) ?? null;

  if (!profiles) {
    return (
      <Card>
        <Empty>Loading Hermes profiles…</Empty>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
          Profile
        </label>
        {profiles.length > 0 && (
          <select
            value={activeId ?? ""}
            onChange={(e) => setActiveId(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} {p.isDefault ? "(default)" : ""}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => setShowNewProfile(!showNewProfile)}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--panel-2)]"
        >
          + New profile
        </button>

        {activeProfile && !activeProfile.isDefault && (
          <DeleteProfileButton
            profileId={activeProfile.id}
            onDeleted={() => {
              setActiveId(null);
              loadProfiles().catch(() => {});
              onToast(`Deleted profile ${activeProfile.id}`, "good");
            }}
            onToast={onToast}
          />
        )}

        {activeProfile && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-dim)]">
            <span className="rounded-md bg-[var(--panel-2)] px-2 py-1">
              {activeProfile.providerCount} provider{activeProfile.providerCount === 1 ? "" : "s"}
            </span>
            <span className="rounded-md bg-[var(--panel-2)] px-2 py-1 font-mono">
              default: {activeProfile.defaultProvider || "—"}/{activeProfile.defaultModel || "—"}
            </span>
            <span
              className={`rounded-md px-2 py-1 ${
                activeProfile.tierRouterEnabled
                  ? "bg-[var(--good)]/12 text-[var(--good)]"
                  : "bg-[var(--panel-2)]"
              }`}
            >
              router {activeProfile.tierRouterEnabled ? "on" : "off"} · {activeProfile.tierCount} tier
              {activeProfile.tierCount === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      {showNewProfile && (
        <NewProfileForm
          onCancel={() => setShowNewProfile(false)}
          onCreated={(id) => {
            setShowNewProfile(false);
            loadProfiles().catch(() => {});
            setActiveId(id);
            onToast(`Created profile ${id}`, "good");
          }}
          onToast={onToast}
        />
      )}

      {profiles.length === 0 ? (
        <Card>
          <Empty>
            No Hermes profiles found. This dashboard reads/writes the live Hermes install at{" "}
            <code className="font-mono">~/.hermes</code>. Create a profile above to get started.
          </Empty>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 border-b border-[var(--border)] pb-2 text-sm">
            {(
              [
                ["providers", "Providers & keys"],
                ["router", "Router & tiers"],
                ["aliases", "Fallback & aliases"],
                ["usage", "Usage"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-lg px-3 py-1.5 ${
                  tab === id ? "bg-[var(--accent)] text-[#06070c] font-semibold" : "hover:bg-[var(--panel-2)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {!activeId || !providers ? (
            <Card>
              <Empty>Loading…</Empty>
            </Card>
          ) : tab === "providers" ? (
            <ProvidersTab
              profileId={activeId}
              providers={providers}
              showAdd={showAddProvider}
              onShowAdd={setShowAddProvider}
              onRefresh={refresh}
              onToast={onToast}
            />
          ) : tab === "router" ? (
            <RouterTab
              profileId={activeId}
              providers={providers}
              tierRouter={tierRouter}
              onRefresh={refresh}
              onToast={onToast}
            />
          ) : tab === "aliases" ? (
            <FallbackAliasesTab key={activeId} profileId={activeId} providers={providers} onToast={onToast} />
          ) : (
            <UsageTab usage={usage} />
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------- Profile lifecycle */

function NewProfileForm({
  onCancel,
  onCreated,
  onToast,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [id, setId] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!id.trim()) {
      onToast("Profile name is required", "bad");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/hermes/profiles`, { method: "POST", json: { id: id.trim() } });
      onCreated(id.trim());
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to create profile", "bad");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="New profile" className="border-[var(--accent)]/40">
      <Field label="Profile name" hint="creates ~/.hermes/profiles/<name>/ with an empty config — letters, digits, . _ -">
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="my-second-profile"
          className={`${inputCls} font-mono`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
        />
      </Field>
      <div className="mt-4 flex gap-3">
        <button
          onClick={create}
          disabled={saving}
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create profile"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm hover:bg-[var(--panel-2)]"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

function DeleteProfileButton({
  profileId,
  onDeleted,
  onToast,
}: {
  profileId: string;
  onDeleted: () => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (
      !confirm(
        `Delete profile "${profileId}"? Its directory is moved aside (not destroyed) but stops appearing everywhere in Hermes.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/api/hermes/profiles/${profileId}`, { method: "DELETE", json: { confirm: true } });
      onDeleted();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Delete failed", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="rounded-lg border border-[var(--bad)]/40 px-3 py-1.5 text-xs text-[var(--bad)] hover:bg-[var(--bad)]/10 disabled:opacity-50"
    >
      {busy ? "Deleting…" : "Delete profile"}
    </button>
  );
}

/* ------------------------------------------------------------ Providers */

interface ProbeResult {
  ok: boolean;
  notTestable: boolean;
  status: number | null;
  latencyMs: number;
  modelCount: number | null;
  error: string | null;
}

function TestProviderButton({ profileId, providerId }: { profileId: string; providerId: string }) {
  const [state, setState] = useState<"idle" | "testing" | "done">("idle");
  const [result, setResult] = useState<ProbeResult | null>(null);

  async function run() {
    setState("testing");
    try {
      const res = await api<ProbeResult>(`/api/hermes/profiles/${profileId}/providers/${providerId}/test`, {
        method: "POST",
      });
      setResult(res);
    } catch (err) {
      setResult({
        ok: false,
        notTestable: false,
        status: null,
        latencyMs: 0,
        modelCount: null,
        error: err instanceof Error ? err.message : "test failed",
      });
    } finally {
      setState("done");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={run}
        disabled={state === "testing"}
        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--panel-2)] disabled:opacity-50"
      >
        {state === "testing" ? "Testing…" : "Test"}
      </button>
      {state === "done" && result && (
        <span
          className={`rounded-md px-2 py-1 text-[11px] ${
            result.notTestable
              ? "bg-[var(--panel-2)] text-[var(--fg-dim)]"
              : result.ok
                ? "bg-[var(--good)]/12 text-[var(--good)]"
                : "bg-[var(--bad)]/12 text-[var(--bad)]"
          }`}
          title={result.error ?? undefined}
        >
          {result.notTestable
            ? "not probeable (oauth/sdk auth)"
            : result.ok
              ? `ok · ${result.latencyMs}ms${result.modelCount !== null ? ` · ${result.modelCount} models` : ""}`
              : `failed${result.status ? ` (${result.status})` : ""}: ${(result.error ?? "").slice(0, 60)}`}
        </span>
      )}
    </span>
  );
}

function ProvidersTab({
  profileId,
  providers,
  showAdd,
  onShowAdd,
  onRefresh,
  onToast,
}: {
  profileId: string;
  providers: HermesProviderView[];
  showAdd: boolean;
  onShowAdd: (v: boolean) => void;
  onRefresh: () => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  async function remove(p: HermesProviderView) {
    if (!confirm(`Remove provider "${p.id}" from this profile? Any tier or fallback entry referencing it is cleared too.`))
      return;
    try {
      await api(`/api/hermes/profiles/${profileId}/providers/${p.id}`, { method: "DELETE" });
      onToast(`Removed ${p.id}`, "good");
      onRefresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Remove failed", "bad");
    }
  }

  async function makeDefault(p: HermesProviderView) {
    try {
      await api(`/api/hermes/profiles/${profileId}/config`, {
        method: "PATCH",
        json: { provider: p.id, model: p.defaultModel || p.id },
      });
      onToast(`${p.id} is now the default provider`, "good");
      onRefresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to set default", "bad");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => onShowAdd(!showAdd)}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#06070c] hover:opacity-90"
        >
          + Add provider
        </button>
      </div>

      {showAdd && (
        <ProviderForm
          profileId={profileId}
          onCancel={() => onShowAdd(false)}
          onSaved={() => {
            onShowAdd(false);
            onRefresh();
            onToast("Provider added", "good");
          }}
          onToast={onToast}
        />
      )}

      {editingId && (
        <ProviderForm
          profileId={profileId}
          provider={providers.find((p) => p.id === editingId)}
          onCancel={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            onRefresh();
            onToast("Provider saved", "good");
          }}
          onToast={onToast}
        />
      )}

      {providers.length === 0 ? (
        <Card>
          <Empty>No providers configured for this profile yet.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {providers.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                    <span className="rounded-md bg-[var(--panel-2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--fg-dim)]">
                      {p.catalogId}
                    </span>
                    {p.isDefault && (
                      <span className="rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                        default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-[var(--fg-dim)]">
                    {p.baseUrl || "(no base URL — provider-managed)"}
                  </p>
                  {p.defaultModel && (
                    <p className="mt-0.5 font-mono text-[11px] text-[var(--fg-dim)]">model: {p.defaultModel}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                {p.authType === "none" ? (
                  <span className="rounded-md bg-[var(--good)]/12 px-2 py-1 text-[var(--good)]">no auth needed</span>
                ) : p.hasKey ? (
                  <span className="rounded-md bg-[var(--good)]/12 px-2 py-1 text-[var(--good)]">
                    key set{p.envVar ? ` (${p.envVar})` : ""}
                  </span>
                ) : (
                  <span className="rounded-md bg-[var(--warn)]/12 px-2 py-1 text-[var(--warn)]">no key set</span>
                )}
                {p.usedInFallback && (
                  <span className="rounded-md bg-[var(--panel-2)] px-2 py-1 text-[var(--fg-dim)]">
                    in global fallback
                  </span>
                )}
                {p.usedInTiers.map((t) => (
                  <span key={t} className="rounded-md bg-[var(--accent-2)]/12 px-2 py-1 text-[var(--accent-2)]">
                    tier: {t}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => setEditingId(p.id)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--panel-2)]"
                >
                  Edit
                </button>
                <TestProviderButton profileId={profileId} providerId={p.id} />
                {!p.isDefault && (
                  <button
                    onClick={() => makeDefault(p)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--panel-2)]"
                  >
                    Make default
                  </button>
                )}
                <button
                  onClick={() => remove(p)}
                  className="ml-auto rounded-lg border border-[var(--bad)]/40 px-3 py-1.5 text-[var(--bad)] hover:bg-[var(--bad)]/10"
                >
                  Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderForm({
  profileId,
  provider,
  onCancel,
  onSaved,
  onToast,
}: {
  profileId: string;
  provider?: HermesProviderView;
  onCancel: () => void;
  onSaved: () => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [form, setForm] = useState({
    id: provider?.id ?? "",
    catalogId: provider?.catalogId ?? "anthropic",
    name: provider?.name ?? "",
    baseUrl: provider?.baseUrl ?? "",
    defaultModel: provider?.defaultModel ?? "",
    requestTimeoutSeconds: provider?.requestTimeoutSeconds ?? 900,
    apiKey: "",
    clearKey: false,
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const isCustom = form.catalogId === "custom";

  async function save() {
    if (!provider && !form.id.trim()) {
      onToast("Provider id is required (config key, e.g. my-fireworks)", "bad");
      return;
    }
    if (isCustom && !form.baseUrl.trim() && !provider) {
      onToast("Base URL is required for a custom / self-hosted provider", "bad");
      return;
    }
    setSaving(true);
    try {
      if (provider) {
        const payload: Record<string, unknown> = {
          name: form.name,
          baseUrl: form.baseUrl,
          defaultModel: form.defaultModel,
          requestTimeoutSeconds: form.requestTimeoutSeconds,
        };
        if (form.clearKey) payload.apiKey = "";
        else if (form.apiKey) payload.apiKey = form.apiKey;
        await api(`/api/hermes/profiles/${profileId}/providers/${provider.id}`, {
          method: "PATCH",
          json: payload,
        });
      } else {
        await api(`/api/hermes/profiles/${profileId}/providers`, {
          method: "POST",
          json: {
            id: form.id,
            catalogId: form.catalogId,
            name: form.name || undefined,
            baseUrl: form.baseUrl || undefined,
            defaultModel: form.defaultModel || undefined,
            requestTimeoutSeconds: form.requestTimeoutSeconds,
            apiKey: form.apiKey || undefined,
          },
        });
      }
      onSaved();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Save failed", "bad");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title={provider ? `Edit ${provider.id}` : "New provider"}
      className="border-[var(--accent)]/40 xl:col-span-2"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {!provider && (
          <Field label="Provider id" hint="config.yaml key, e.g. my-fireworks — letters, digits, . _ -">
            <input
              value={form.id}
              onChange={(e) => set("id", e.target.value)}
              placeholder="my-fireworks"
              className={`${inputCls} font-mono`}
            />
          </Field>
        )}

        {!provider && (
          <Field label="Type">
            <select
              value={form.catalogId}
              onChange={(e) => set("catalogId", e.target.value)}
              className={inputCls}
            >
              {CATALOG.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Display name">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="My Fireworks account"
            className={inputCls}
          />
        </Field>

        <Field
          label={isCustom ? "Base URL (required)" : "Base URL override"}
          hint={isCustom ? "e.g. http://192.168.1.50:11434/v1" : "leave blank to use the provider's default endpoint"}
          className="md:col-span-2"
        >
          <input
            value={form.baseUrl}
            onChange={(e) => set("baseUrl", e.target.value)}
            placeholder="https://api.example.com/v1"
            className={`${inputCls} font-mono`}
          />
        </Field>

        <Field label="Default model" hint="what this provider runs when nothing else specifies a model">
          <input
            value={form.defaultModel}
            onChange={(e) => set("defaultModel", e.target.value)}
            placeholder="qwen3-coder:30b"
            className={`${inputCls} font-mono`}
          />
        </Field>

        <Field label="Request timeout (seconds)">
          <input
            type="number"
            min={1}
            value={form.requestTimeoutSeconds}
            onChange={(e) => set("requestTimeoutSeconds", Number(e.target.value) || 900)}
            className={inputCls}
          />
        </Field>

        <Field
          label={provider?.hasKey ? "Replace API key" : "API key"}
          hint={
            provider
              ? `Written to this profile's .env${provider.envVar ? ` as ${provider.envVar}` : ""}.`
              : "Written to this profile's .env under the provider's standard variable name."
          }
          className="md:col-span-2"
        >
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => set("apiKey", e.target.value)}
            placeholder={provider?.hasKey ? "leave blank to keep current key" : "sk-…"}
            autoComplete="new-password"
            className={`${inputCls} font-mono`}
            disabled={form.clearKey}
          />
          {provider?.hasKey && (
            <label className="mt-2 flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
              <input
                type="checkbox"
                checked={form.clearKey}
                onChange={(e) => set("clearKey", e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--bad)]"
              />
              Remove the stored key
            </label>
          )}
        </Field>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save provider"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm hover:bg-[var(--panel-2)]"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- Router */

function RouterTab({
  profileId,
  providers,
  tierRouter,
  onRefresh,
  onToast,
}: {
  profileId: string;
  providers: HermesProviderView[];
  tierRouter: TierRouterConfig | null;
  onRefresh: () => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [addingTier, setAddingTier] = useState(false);
  const enabled = tierRouter?.enabled ?? false;
  const tiers = tierRouter?.tiers ?? {};

  async function toggleEnabled() {
    try {
      await api(`/api/hermes/profiles/${profileId}/tiers`, { method: "PATCH", json: { enabled: !enabled } });
      onToast(!enabled ? "Tier router enabled" : "Tier router disabled", "good");
      onRefresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to toggle router", "bad");
    }
  }

  async function setDefaultTier(name: string) {
    try {
      await api(`/api/hermes/profiles/${profileId}/tiers`, { method: "PATCH", json: { default_tier: name } });
      onRefresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to set default tier", "bad");
    }
  }

  async function deleteTier(name: string) {
    if (!confirm(`Delete tier "${name}"?`)) return;
    try {
      await api(`/api/hermes/profiles/${profileId}/tiers/${name}`, { method: "DELETE" });
      onToast(`Deleted tier ${name}`, "good");
      onRefresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Delete failed", "bad");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Tier router</h3>
            <p className="mt-1 text-[11px] text-[var(--fg-dim)]">
              When enabled, each turn is classified into a tier and routed to that tier&apos;s model pool instead of
              always using the profile&apos;s default model.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={toggleEnabled}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {enabled ? "Enabled" : "Disabled"}
          </label>
        </div>
        {tierRouter && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <Field label="Default tier" className="min-w-[10rem]">
              <select
                value={tierRouter.default_tier}
                onChange={(e) => setDefaultTier(e.target.value)}
                className={inputCls}
              >
                {Object.keys(tiers).length === 0 ? (
                  <option value={tierRouter.default_tier}>{tierRouter.default_tier}</option>
                ) : (
                  Object.keys(tiers).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                )}
              </select>
            </Field>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <button
          onClick={() => setAddingTier(!addingTier)}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#06070c] hover:opacity-90"
        >
          + Add tier
        </button>
      </div>

      {addingTier && (
        <TierForm
          profileId={profileId}
          providers={providers}
          existingNames={Object.keys(tiers)}
          onCancel={() => setAddingTier(false)}
          onSaved={() => {
            setAddingTier(false);
            onRefresh();
            onToast("Tier saved", "good");
          }}
          onToast={onToast}
        />
      )}

      {Object.keys(tiers).length === 0 ? (
        <Card>
          <Empty>No tiers configured. Add one to start routing by tier instead of a single default model.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.entries(tiers).map(([name, tier]) => (
            <TierCard
              key={name}
              profileId={profileId}
              providers={providers}
              name={name}
              tier={tier}
              tierRouter={tierRouter}
              isDefault={tierRouter?.default_tier === name}
              onDelete={() => deleteTier(name)}
              onRefresh={onRefresh}
              onToast={onToast}
            />
          ))}
        </div>
      )}

      <Card title="Classifier pool" >
        <p className="mb-3 text-[11px] text-[var(--fg-dim)]">
          Small/cheap models used only to decide which tier a turn belongs to — never used to answer the turn
          itself.
        </p>
        <ClassifierPoolEditor
          profileId={profileId}
          providers={providers}
          pool={tierRouter?.classifier.pool ?? []}
          onSaved={() => {
            onRefresh();
            onToast("Classifier pool saved", "good");
          }}
          onToast={onToast}
        />
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <ClassifierSettingsForm
            profileId={profileId}
            timeoutS={tierRouter?.classifier.timeout_s}
            historyTurns={tierRouter?.classifier.history_turns}
            onSaved={() => {
              onRefresh();
              onToast("Classifier settings saved", "good");
            }}
            onToast={onToast}
          />
        </div>
      </Card>

      <Card title="Task routes">
        <p className="mb-3 text-[11px] text-[var(--fg-dim)]">
          Force a specific task/subtype straight to a tier, bypassing the classifier (e.g. task
          <code className="mx-1 font-mono">plan</code>, subtype <code className="mx-1 font-mono">easy</code> →
          tier <code className="mx-1 font-mono">plan</code>).
        </p>
        <TaskRoutesEditor
          profileId={profileId}
          routes={tierRouter?.routes ?? {}}
          tierNames={Object.keys(tierRouter?.tiers ?? {})}
          onSaved={() => {
            onRefresh();
            onToast("Route saved", "good");
          }}
          onToast={onToast}
        />
      </Card>
    </div>
  );
}

function TierCard({
  profileId,
  providers,
  name,
  tier,
  tierRouter,
  isDefault,
  onDelete,
  onRefresh,
  onToast,
}: {
  profileId: string;
  providers: HermesProviderView[];
  name: string;
  tier: TierEntry;
  tierRouter: TierRouterConfig | null;
  isDefault: boolean;
  onDelete: () => void;
  onRefresh: () => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TierForm
        profileId={profileId}
        providers={providers}
        existingNames={Object.keys(tierRouter?.tiers ?? {})}
        editingName={name}
        initial={tier}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onRefresh();
          onToast("Tier saved", "good");
        }}
        onToast={onToast}
      />
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{name}</h3>
          {isDefault && (
            <span className="rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
              default
            </span>
          )}
          <span className="rounded-md bg-[var(--panel-2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--fg-dim)]">
            {tier.mode ?? "round_robin"}
          </span>
        </div>
      </div>

      <RefList label="Pool" refs={tier.pool} />
      <RefList label="Fallback" refs={tier.fallback} />

      {tier.escalate_to && (
        <p className="mt-2 text-[11px] text-[var(--fg-dim)]">
          Escalates to tier: <span className="font-mono text-[var(--accent-2)]">{tier.escalate_to}</span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--panel-2)]"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="ml-auto rounded-lg border border-[var(--bad)]/40 px-3 py-1.5 text-[var(--bad)] hover:bg-[var(--bad)]/10"
        >
          Delete
        </button>
      </div>
    </Card>
  );
}

function RefList({ label, refs }: { label: string; refs: ModelRef[] }) {
  if (refs.length === 0) {
    return (
      <p className="mt-3 text-[11px] text-[var(--fg-dim)]">
        {label}: <span className="italic">empty</span>
      </p>
    );
  }
  return (
    <div className="mt-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {refs.map((r, i) => (
          <span
            key={`${r.provider}/${r.model}/${i}`}
            className="rounded-md bg-[var(--panel-2)] px-2 py-1 font-mono text-[11px]"
          >
            {r.provider}/{r.model}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Shared editor for a list of {provider, model} refs, backed by two <select>+add-row UI. */
function ModelRefListEditor({
  providers,
  refs,
  onChange,
}: {
  providers: HermesProviderView[];
  refs: ModelRef[];
  onChange: (next: ModelRef[]) => void;
}) {
  const [provider, setProvider] = useState(providers[0]?.id ?? "");
  const [model, setModel] = useState("");

  function add() {
    if (!provider || !model.trim()) return;
    onChange([...refs, { provider, model: model.trim() }]);
    setModel("");
  }

  function remove(i: number) {
    onChange(refs.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {refs.map((r, i) => (
          <span
            key={`${r.provider}/${r.model}/${i}`}
            className="flex items-center gap-1.5 rounded-md bg-[var(--panel-2)] px-2 py-1 font-mono text-[11px]"
          >
            {r.provider}/{r.model}
            <button onClick={() => remove(i)} className="text-[var(--bad)] hover:opacity-70">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className={`${inputCls} max-w-[10rem]`}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="model name"
          className={`${inputCls} max-w-[12rem] font-mono`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          onClick={add}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--panel-2)]"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

function ClassifierPoolEditor({
  profileId,
  providers,
  pool,
  onSaved,
  onToast,
}: {
  profileId: string;
  providers: HermesProviderView[];
  pool: ModelRef[];
  onSaved: () => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [local, setLocal] = useState<ModelRef[]>(pool);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(local) !== JSON.stringify(pool);
  const [lastPool, setLastPool] = useState(pool);
  if (pool !== lastPool) {
    // Re-derive local state from a changed prop during render (React's
    // documented pattern for "adjusting state when a prop changes")
    // instead of useEffect, which would setState after an extra render.
    setLastPool(pool);
    setLocal(pool);
  }

  async function save() {
    setSaving(true);
    try {
      await api(`/api/hermes/profiles/${profileId}/tiers`, {
        method: "PATCH",
        json: { classifier_pool: local },
      });
      onSaved();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Save failed", "bad");
    } finally {
      setSaving(false);
    }
  }

  if (providers.length === 0) {
    return <Empty>Add a provider first.</Empty>;
  }

  return (
    <div>
      <ModelRefListEditor providers={providers} refs={local} onChange={setLocal} />
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save classifier pool"}
        </button>
      )}
    </div>
  );
}

function ClassifierSettingsForm({
  profileId,
  timeoutS,
  historyTurns,
  onSaved,
  onToast,
}: {
  profileId: string;
  timeoutS: number | undefined;
  historyTurns: number | undefined;
  onSaved: () => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [timeoutStr, setTimeoutStr] = useState(timeoutS !== undefined ? String(timeoutS) : "");
  const [historyStr, setHistoryStr] = useState(historyTurns !== undefined ? String(historyTurns) : "");
  const [saving, setSaving] = useState(false);
  const [lastTimeoutS, setLastTimeoutS] = useState(timeoutS);
  const [lastHistoryTurns, setLastHistoryTurns] = useState(historyTurns);
  if (timeoutS !== lastTimeoutS || historyTurns !== lastHistoryTurns) {
    setLastTimeoutS(timeoutS);
    setLastHistoryTurns(historyTurns);
    setTimeoutStr(timeoutS !== undefined ? String(timeoutS) : "");
    setHistoryStr(historyTurns !== undefined ? String(historyTurns) : "");
  }

  async function save() {
    const patch: { timeout_s?: number; history_turns?: number } = {};
    if (timeoutStr.trim()) {
      const n = Number(timeoutStr);
      if (!Number.isFinite(n) || n <= 0) {
        onToast("Timeout must be a positive number of seconds", "bad");
        return;
      }
      patch.timeout_s = n;
    }
    if (historyStr.trim()) {
      const n = Number(historyStr);
      if (!Number.isInteger(n) || n < 0) {
        onToast("History turns must be a non-negative whole number", "bad");
        return;
      }
      patch.history_turns = n;
    }
    if (Object.keys(patch).length === 0) return;

    setSaving(true);
    try {
      await api(`/api/hermes/profiles/${profileId}/classifier`, { method: "PATCH", json: patch });
      onSaved();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Save failed", "bad");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Timeout (seconds)" hint="how long the classifier call is allowed to take">
        <input
          value={timeoutStr}
          onChange={(e) => setTimeoutStr(e.target.value)}
          placeholder="12"
          inputMode="decimal"
          className={`${inputCls} w-28 font-mono`}
        />
      </Field>
      <Field label="History turns" hint="how many prior turns feed the classifier's decision">
        <input
          value={historyStr}
          onChange={(e) => setHistoryStr(e.target.value)}
          placeholder="4"
          inputMode="numeric"
          className={`${inputCls} w-28 font-mono`}
        />
      </Field>
      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save classifier settings"}
      </button>
    </div>
  );
}

function TaskRoutesEditor({
  profileId,
  routes,
  tierNames,
  onSaved,
  onToast,
}: {
  profileId: string;
  routes: Record<string, Record<string, string>>;
  tierNames: string[];
  onSaved: () => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [task, setTask] = useState("");
  const [subtype, setSubtype] = useState("");
  const [tier, setTier] = useState(tierNames[0] ?? "");
  const [saving, setSaving] = useState(false);

  const flat = Object.entries(routes).flatMap(([t, subtypes]) =>
    Object.entries(subtypes).map(([s, target]) => ({ task: t, subtype: s, target })),
  );

  async function addRoute() {
    if (!task.trim() || !subtype.trim() || !tier.trim()) {
      onToast("Task, subtype, and tier are all required", "bad");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/hermes/profiles/${profileId}/classifier`, {
        method: "POST",
        json: { task: task.trim(), subtype: subtype.trim(), tier: tier.trim() },
      });
      setTask("");
      setSubtype("");
      onSaved();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Save failed", "bad");
    } finally {
      setSaving(false);
    }
  }

  async function removeRoute(t: string, s: string) {
    try {
      await api(`/api/hermes/profiles/${profileId}/classifier`, {
        method: "DELETE",
        json: { task: t, subtype: s },
      });
      onSaved();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Remove failed", "bad");
    }
  }

  return (
    <div>
      {flat.length > 0 && (
        <table className="mb-4 w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--fg-dim)]">
              <th className="pb-2 font-medium">Task</th>
              <th className="pb-2 font-medium">Subtype</th>
              <th className="pb-2 font-medium">Tier</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {flat.map((r) => (
              <tr key={`${r.task}.${r.subtype}`} className="border-t border-[var(--border)]">
                <td className="py-2 font-mono">{r.task}</td>
                <td className="py-2 font-mono">{r.subtype}</td>
                <td className="py-2 font-mono">{r.target}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => removeRoute(r.task, r.subtype)}
                    className="rounded-md border border-[var(--bad)]/40 px-2 py-1 text-[var(--bad)] hover:bg-[var(--bad)]/10"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tierNames.length === 0 ? (
        <Empty>Add a tier first.</Empty>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Task">
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="plan"
              className={`${inputCls} w-32 font-mono`}
            />
          </Field>
          <Field label="Subtype">
            <input
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              placeholder="easy"
              className={`${inputCls} w-32 font-mono`}
            />
          </Field>
          <Field label="Tier">
            <select value={tier} onChange={(e) => setTier(e.target.value)} className={inputCls}>
              {tierNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <button
            onClick={addRoute}
            disabled={saving}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add route"}
          </button>
        </div>
      )}
    </div>
  );
}

function TierForm({
  profileId,
  providers,
  existingNames,
  editingName,
  initial,
  onCancel,
  onSaved,
  onToast,
}: {
  profileId: string;
  providers: HermesProviderView[];
  existingNames: string[];
  editingName?: string;
  initial?: TierEntry;
  onCancel: () => void;
  onSaved: () => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [name, setName] = useState(editingName ?? "");
  const [mode, setMode] = useState<"round_robin" | "priority">(initial?.mode ?? "round_robin");
  const [escalateTo, setEscalateTo] = useState(initial?.escalate_to ?? "");
  const [pool, setPool] = useState<ModelRef[]>(initial?.pool ?? []);
  const [fallback, setFallback] = useState<ModelRef[]>(initial?.fallback ?? []);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      onToast("Tier name is required", "bad");
      return;
    }
    if (pool.length === 0) {
      onToast("A tier needs at least one model in its pool", "bad");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/hermes/profiles/${profileId}/tiers`, {
        method: "POST",
        json: {
          name: name.trim(),
          mode,
          escalate_to: escalateTo || null,
          pool,
          fallback,
        },
      });
      onSaved();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Save failed", "bad");
    } finally {
      setSaving(false);
    }
  }

  if (providers.length === 0) {
    return (
      <Card className="border-[var(--accent)]/40 xl:col-span-2">
        <Empty>Add at least one provider before creating a tier.</Empty>
      </Card>
    );
  }

  return (
    <Card title={editingName ? `Edit tier: ${editingName}` : "New tier"} className="border-[var(--accent)]/40 xl:col-span-2">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tier name" hint="e.g. trivial, normal, complex, plan">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!!editingName}
            placeholder="normal"
            className={`${inputCls} font-mono`}
          />
        </Field>

        <Field label="Selection mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as "round_robin" | "priority")} className={inputCls}>
            <option value="round_robin">Round robin (spread load across the pool)</option>
            <option value="priority">Priority (always try pool[0] first)</option>
          </select>
        </Field>

        <Field
          label="Escalate to"
          hint="Optional: when this tier's pool is exhausted, retry with a different tier's pool"
          className="md:col-span-2"
        >
          <select value={escalateTo} onChange={(e) => setEscalateTo(e.target.value)} className={inputCls}>
            <option value="">(none)</option>
            {existingNames
              .filter((n) => n !== editingName)
              .map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Model pool" hint="Models this tier routes to, in order" className="md:col-span-2">
          <ModelRefListEditor providers={providers} refs={pool} onChange={setPool} />
        </Field>

        <Field label="Fallback" hint="Used only when every pool model fails" className="md:col-span-2">
          <ModelRefListEditor providers={providers} refs={fallback} onChange={setFallback} />
        </Field>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save tier"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm hover:bg-[var(--panel-2)]"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------- Fallback & aliases */

function FallbackAliasesTab({
  profileId,
  providers,
  onToast,
}: {
  profileId: string;
  providers: HermesProviderView[];
  onToast: (m: string, t?: Tone) => void;
}) {
  const [chain, setChain] = useState<ModelRef[] | null>(null);
  const [aliases, setAliases] = useState<Record<string, ModelRef> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [chainRes, aliasRes] = await Promise.all([
          api<{ chain: ModelRef[] }>(`/api/hermes/profiles/${profileId}/fallback`),
          api<{ aliases: Record<string, ModelRef> }>(`/api/hermes/profiles/${profileId}/aliases`),
        ]);
        if (cancelled) return;
        setChain(chainRes.chain);
        setAliases(aliasRes.aliases);
      } catch (err) {
        if (!cancelled) onToast(err instanceof Error ? err.message : "Failed to load", "bad");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, onToast]);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Global fallback chain">
        <p className="mb-3 text-[11px] text-[var(--fg-dim)]">
          Used when a provider call fails outside the tier router (or by a tier with no fallback of its own).
          Order is the failover order.
        </p>
        {chain === null || !providers ? (
          <Empty>Loading…</Empty>
        ) : (
          <FallbackChainEditor
            profileId={profileId}
            providers={providers}
            chain={chain}
            onSaved={(next) => {
              setChain(next);
              onToast("Fallback chain saved", "good");
            }}
            onToast={onToast}
          />
        )}
      </Card>

      <Card title="Model aliases">
        <p className="mb-3 text-[11px] text-[var(--fg-dim)]">
          Friendly names resolvable via <code className="font-mono">/model &lt;alias&gt;</code> or as{" "}
          <code className="font-mono">model.default</code>, instead of a raw provider/model pair.
        </p>
        {aliases === null || !providers ? (
          <Empty>Loading…</Empty>
        ) : (
          <AliasesEditor
            profileId={profileId}
            providers={providers}
            aliases={aliases}
            onSaved={(next) => {
              setAliases(next);
              onToast("Alias saved", "good");
            }}
            onToast={onToast}
          />
        )}
      </Card>
    </div>
  );
}

function FallbackChainEditor({
  profileId,
  providers,
  chain,
  onSaved,
  onToast,
}: {
  profileId: string;
  providers: HermesProviderView[];
  chain: ModelRef[];
  onSaved: (next: ModelRef[]) => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [local, setLocal] = useState<ModelRef[]>(chain);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(local) !== JSON.stringify(chain);
  const [lastChain, setLastChain] = useState(chain);
  if (chain !== lastChain) {
    setLastChain(chain);
    setLocal(chain);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await api<{ chain: ModelRef[] }>(`/api/hermes/profiles/${profileId}/fallback`, {
        method: "PUT",
        json: { chain: local },
      });
      onSaved(res.chain);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Save failed", "bad");
    } finally {
      setSaving(false);
    }
  }

  if (providers.length === 0) {
    return <Empty>Add a provider first.</Empty>;
  }

  return (
    <div>
      <ModelRefListEditor providers={providers} refs={local} onChange={setLocal} />
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save fallback chain"}
        </button>
      )}
    </div>
  );
}

function AliasesEditor({
  profileId,
  providers,
  aliases,
  onSaved,
  onToast,
}: {
  profileId: string;
  providers: HermesProviderView[];
  aliases: Record<string, ModelRef>;
  onSaved: (next: Record<string, ModelRef>) => void;
  onToast: (m: string, t?: Tone) => void;
}) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState(providers[0]?.id ?? "");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  async function addAlias() {
    if (!name.trim() || !provider || !model.trim()) {
      onToast("Alias name, provider, and model are all required", "bad");
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ aliases: Record<string, ModelRef> }>(`/api/hermes/profiles/${profileId}/aliases`, {
        method: "POST",
        json: { name: name.trim(), ref: { provider, model: model.trim() } },
      });
      setName("");
      setModel("");
      onSaved(res.aliases);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Save failed", "bad");
    } finally {
      setSaving(false);
    }
  }

  async function removeAlias(aliasName: string) {
    try {
      const res = await api<{ aliases: Record<string, ModelRef> }>(`/api/hermes/profiles/${profileId}/aliases`, {
        method: "DELETE",
        json: { name: aliasName },
      });
      onSaved(res.aliases);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Remove failed", "bad");
    }
  }

  const entries = Object.entries(aliases);

  return (
    <div>
      {entries.length > 0 && (
        <table className="mb-4 w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--fg-dim)]">
              <th className="pb-2 font-medium">Alias</th>
              <th className="pb-2 font-medium">Provider / model</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map(([aliasName, ref]) => (
              <tr key={aliasName} className="border-t border-[var(--border)]">
                <td className="py-2 font-mono">{aliasName}</td>
                <td className="py-2 font-mono">
                  {ref.provider}/{ref.model}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => removeAlias(aliasName)}
                    className="rounded-md border border-[var(--bad)]/40 px-2 py-1 text-[var(--bad)] hover:bg-[var(--bad)]/10"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {providers.length === 0 ? (
        <Empty>Add a provider first.</Empty>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Alias name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="fast"
              className={`${inputCls} w-32 font-mono`}
            />
          </Field>
          <Field label="Provider">
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputCls}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Model">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="claude-opus-5"
              className={`${inputCls} w-40 font-mono`}
            />
          </Field>
          <button
            onClick={addAlias}
            disabled={saving}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add alias"}
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Usage */

function UsageTab({ usage }: { usage: ProfileUsageSummary | null }) {
  if (!usage) {
    return (
      <Card>
        <Empty>Loading usage…</Empty>
      </Card>
    );
  }
  if (usage.rows.length === 0) {
    return (
      <Card>
        <Empty>No recorded model usage for this profile yet.</Empty>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-[var(--fg-dim)]">API calls</p>
          <p className="mt-1 text-2xl font-semibold">{fmtNum(usage.totalCalls)}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-[var(--fg-dim)]">Tokens</p>
          <p className="mt-1 text-2xl font-semibold">{fmtNum(usage.totalTokens)}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wider text-[var(--fg-dim)]">Est. cost</p>
          <p className="mt-1 text-2xl font-semibold">{fmtUsd(usage.totalCostUsd)}</p>
        </Card>
      </div>

      <Card title="By model">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[var(--fg-dim)]">
              <tr>
                <th className="py-2 pr-3 font-medium">Model</th>
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 pr-3 font-medium">Calls</th>
                <th className="py-2 pr-3 font-medium">In tok</th>
                <th className="py-2 pr-3 font-medium">Out tok</th>
                <th className="py-2 pr-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {usage.rows.map((r) => (
                <tr key={r.model} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3 font-mono">{r.model}</td>
                  <td className="py-2 pr-3">{r.billingProvider || "—"}</td>
                  <td className="py-2 pr-3">{fmtNum(r.apiCallCount)}</td>
                  <td className="py-2 pr-3">{fmtNum(r.inputTokens)}</td>
                  <td className="py-2 pr-3">{fmtNum(r.outputTokens)}</td>
                  <td className="py-2 pr-3">{fmtUsd(r.actualCostUsd || r.estimatedCostUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[var(--fg-dim)]">
          Cost is Hermes&apos;s own estimate/actual figure per call — exact for providers with billing APIs, best-effort
          elsewhere (e.g. many local runs price at $0).
        </p>
      </Card>

      {usage.byProvider.length > 0 && (
        <Card title="By billing provider">
          <div className="flex flex-wrap gap-2">
            {usage.byProvider.map((p) => (
              <span key={p.provider} className="rounded-lg bg-[var(--panel-2)] px-3 py-2 text-xs">
                <span className="font-semibold">{p.provider || "unknown"}</span> · {fmtNum(p.calls)} calls ·{" "}
                {fmtUsd(p.costUsd)}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
