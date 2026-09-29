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
  classifier: { pool: ModelRef[] };
  tiers: Record<string, TierEntry>;
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
  const [tab, setTab] = useState<"providers" | "router" | "usage">("providers");
  const [showAddProvider, setShowAddProvider] = useState(false);

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

  if (profiles.length === 0) {
    return (
      <Card>
        <Empty>
          No Hermes profiles found. This dashboard reads/writes the live Hermes install at{" "}
          <code className="font-mono">~/.hermes</code>.
        </Empty>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
          Profile
        </label>
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

      <div className="flex gap-2 border-b border-[var(--border)] pb-2 text-sm">
        {(
          [
            ["providers", "Providers & keys"],
            ["router", "Router & tiers"],
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
      ) : (
        <UsageTab usage={usage} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Providers */

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
