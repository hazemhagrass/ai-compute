"use client";

import { useState } from "react";

import { api } from "./store";
import { Card, Empty } from "./ui";
import type { AuthType, Provider, ProviderKind } from "@/lib/types";

const KINDS: { value: ProviderKind; label: string }[] = [
  { value: "cloud", label: "Cloud API" },
  { value: "local", label: "Local / self-hosted" },
  { value: "gateway", label: "Gateway / aggregator" },
  { value: "custom", label: "Custom" },
];

const AUTH_TYPES: { value: AuthType; label: string; hint: string }[] = [
  { value: "bearer", label: "Bearer token", hint: "Authorization: Bearer <key>" },
  { value: "header", label: "Raw header", hint: "e.g. x-api-key: <key>" },
  { value: "query", label: "Query param", hint: "?key=<key>" },
  { value: "basic", label: "HTTP Basic", hint: "Authorization: Basic base64(key)" },
  { value: "none", label: "No auth", hint: "local servers, open endpoints" },
];

interface TestState {
  status: "idle" | "running" | "ok" | "fail";
  message?: string;
  models?: string[];
}

export default function ProvidersPanel({
  providers,
  onToast,
  onRefresh,
}: {
  providers: Provider[];
  onToast: (msg: string, tone?: "info" | "good" | "bad") => void;
  onRefresh: () => void;
}) {
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [tests, setTests] = useState<Record<number, TestState>>({});
  const [filter, setFilter] = useState("");

  async function testProvider(p: Provider) {
    setTests((t) => ({ ...t, [p.id]: { status: "running" } }));
    try {
      const res = await api<{
        result: { ok: boolean; status: number; latencyMs: number; modelCount?: number; models?: string[]; error?: string };
      }>(`/api/providers/${p.id}/test`, { method: "POST" });
      const r = res.result;
      setTests((t) => ({
        ...t,
        [p.id]: r.ok
          ? {
              status: "ok",
              message: `${r.latencyMs}ms · ${r.modelCount ?? 0} models`,
              models: r.models,
            }
          : { status: "fail", message: `HTTP ${r.status}: ${r.error ?? "failed"}` },
      }));
    } catch (err) {
      setTests((t) => ({
        ...t,
        [p.id]: { status: "fail", message: err instanceof Error ? err.message : "failed" },
      }));
    }
  }

  async function discover(p: Provider) {
    try {
      const res = await api<{ imported: string[]; skipped: number; total: number }>(
        `/api/providers/${p.id}/discover`,
        { method: "POST" },
      );
      onToast(
        `Imported ${res.imported.length} new models (${res.skipped} already known)`,
        "good",
      );
      onRefresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Discovery failed", "bad");
    }
  }

  async function remove(p: Provider) {
    if (!confirm(`Delete "${p.name}" and all its models?`)) return;
    try {
      await api(`/api/providers/${p.id}`, { method: "DELETE" });
      onToast(`Deleted ${p.name}`, "good");
      onRefresh();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Delete failed", "bad");
    }
  }

  async function toggle(p: Provider) {
    await api(`/api/providers/${p.id}`, {
      method: "PATCH",
      json: { enabled: !p.enabled },
    });
    onRefresh();
  }

  const shown = providers.filter(
    (p) =>
      !filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.baseUrl.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter providers…"
          className="min-w-[14rem] flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 px-4 py-2.5 text-sm outline-none placeholder:text-[var(--fg-dim)] focus:border-[var(--accent)]"
        />
        <button
          onClick={() => setEditingId("new")}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#06070c] hover:opacity-90"
        >
          + Add provider
        </button>
        <a
          href="/api/export"
          className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm hover:bg-[var(--panel-2)]"
        >
          Export config
        </a>
      </div>

      {editingId === "new" && (
        <ProviderForm
          onCancel={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            onRefresh();
            onToast("Provider added", "good");
          }}
          onToast={onToast}
        />
      )}

      {shown.length === 0 ? (
        <Card>
          <Empty>No providers match that filter.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shown.map((p) =>
            editingId === p.id ? (
              <ProviderForm
                key={p.id}
                provider={p}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  onRefresh();
                  onToast("Provider saved", "good");
                }}
                onToast={onToast}
              />
            ) : (
              <ProviderCard
                key={p.id}
                provider={p}
                test={tests[p.id]}
                onEdit={() => setEditingId(p.id)}
                onTest={() => testProvider(p)}
                onDiscover={() => discover(p)}
                onDelete={() => remove(p)}
                onToggle={() => toggle(p)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  provider: p,
  test,
  onEdit,
  onTest,
  onDiscover,
  onDelete,
  onToggle,
}: {
  provider: Provider;
  test?: TestState;
  onEdit: () => void;
  onTest: () => void;
  onDiscover: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const kindColor = {
    cloud: "var(--accent)",
    local: "var(--good)",
    gateway: "var(--accent-2)",
    custom: "var(--warn)",
  }[p.kind];

  return (
    <Card className={p.enabled ? "" : "opacity-55"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: kindColor }}
            />
            <h3 className="truncate text-sm font-semibold">{p.name}</h3>
            <span className="rounded-md bg-[var(--panel-2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--fg-dim)]">
              {p.kind}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--fg-dim)]">
            {p.baseUrl}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[11px] text-[var(--fg-dim)]">
          <input
            type="checkbox"
            checked={p.enabled}
            onChange={onToggle}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          on
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        {p.authType === "none" ? (
          <span className="rounded-md bg-[var(--good)]/12 px-2 py-1 text-[var(--good)]">
            no auth needed
          </span>
        ) : p.hasKey ? (
          <span className="rounded-md bg-[var(--good)]/12 px-2 py-1 font-mono text-[var(--good)]">
            key {p.keyPreview}
          </span>
        ) : (
          <span className="rounded-md bg-[var(--warn)]/12 px-2 py-1 text-[var(--warn)]">
            no key set
          </span>
        )}
        <span className="rounded-md bg-[var(--panel-2)] px-2 py-1 text-[var(--fg-dim)]">
          {p.authType}
        </span>
      </div>

      {test && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-[11px] ${
            test.status === "ok"
              ? "bg-[var(--good)]/10 text-[var(--good)]"
              : test.status === "fail"
                ? "bg-[var(--bad)]/10 text-[var(--bad)]"
                : "bg-[var(--panel-2)] text-[var(--fg-muted)] amr-pulse"
          }`}
        >
          {test.status === "running" ? "Testing connection…" : test.message}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button
          onClick={onTest}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--panel-2)]"
        >
          Test
        </button>
        <button
          onClick={onDiscover}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--panel-2)]"
        >
          Import models
        </button>
        <button
          onClick={onEdit}
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

function ProviderForm({
  provider,
  onCancel,
  onSaved,
  onToast,
}: {
  provider?: Provider;
  onCancel: () => void;
  onSaved: () => void;
  onToast: (m: string, t?: "info" | "good" | "bad") => void;
}) {
  const [form, setForm] = useState({
    name: provider?.name ?? "",
    kind: provider?.kind ?? ("cloud" as ProviderKind),
    baseUrl: provider?.baseUrl ?? "",
    chatPath: provider?.chatPath ?? "/chat/completions",
    modelsPath: provider?.modelsPath ?? "/models",
    authType: provider?.authType ?? ("bearer" as AuthType),
    authHeaderName: provider?.authHeaderName ?? "Authorization",
    authQueryName: provider?.authQueryName ?? "key",
    headers: JSON.stringify(provider?.headers ?? {}, null, 2),
    apiKey: "",
    clearKey: false,
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name.trim() || !form.baseUrl.trim()) {
      onToast("Name and base URL are required", "bad");
      return;
    }
    let headers: Record<string, string> = {};
    try {
      headers = JSON.parse(form.headers || "{}");
    } catch {
      onToast("Extra headers must be valid JSON", "bad");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        kind: form.kind,
        baseUrl: form.baseUrl,
        chatPath: form.chatPath,
        modelsPath: form.modelsPath,
        authType: form.authType,
        authHeaderName: form.authHeaderName,
        authQueryName: form.authQueryName,
        headers,
      };
      if (form.clearKey) payload.apiKey = "";
      else if (form.apiKey) payload.apiKey = form.apiKey;

      if (provider) {
        await api(`/api/providers/${provider.id}`, { method: "PATCH", json: payload });
      } else {
        await api("/api/providers", { method: "POST", json: payload });
      }
      onSaved();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Save failed", "bad");
    } finally {
      setSaving(false);
    }
  }

  const authHint = AUTH_TYPES.find((a) => a.value === form.authType)?.hint;

  return (
    <Card
      title={provider ? `Edit ${provider.name}` : "New provider"}
      className="border-[var(--accent)]/40 xl:col-span-2"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Display name">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="My Fireworks account"
            className={inputCls}
          />
        </Field>

        <Field label="Type">
          <select
            value={form.kind}
            onChange={(e) => set("kind", e.target.value as ProviderKind)}
            className={inputCls}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Base URL"
          hint="IP, domain, or subdomain — e.g. http://192.168.1.50:11434/v1"
          className="md:col-span-2"
        >
          <input
            value={form.baseUrl}
            onChange={(e) => set("baseUrl", e.target.value)}
            placeholder="https://api.example.com/v1"
            className={`${inputCls} font-mono`}
          />
        </Field>

        <Field label="Chat path">
          <input
            value={form.chatPath}
            onChange={(e) => set("chatPath", e.target.value)}
            className={`${inputCls} font-mono`}
          />
        </Field>

        <Field label="Models path" hint="blank = no model discovery">
          <input
            value={form.modelsPath}
            onChange={(e) => set("modelsPath", e.target.value)}
            className={`${inputCls} font-mono`}
          />
        </Field>

        <Field label="Auth type" hint={authHint}>
          <select
            value={form.authType}
            onChange={(e) => set("authType", e.target.value as AuthType)}
            className={inputCls}
          >
            {AUTH_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        {(form.authType === "bearer" || form.authType === "header") && (
          <Field label="Header name">
            <input
              value={form.authHeaderName}
              onChange={(e) => set("authHeaderName", e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </Field>
        )}

        {form.authType === "query" && (
          <Field label="Query param name">
            <input
              value={form.authQueryName}
              onChange={(e) => set("authQueryName", e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </Field>
        )}

        {form.authType !== "none" && (
          <Field
            label={provider?.hasKey ? "Replace API key" : "API key"}
            hint="Encrypted with AES-256-GCM before it touches disk. Never sent back to the browser."
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
        )}

        <Field
          label="Extra headers (JSON)"
          hint="e.g. org ids, project ids, anthropic-version"
          className="md:col-span-2"
        >
          <textarea
            value={form.headers}
            onChange={(e) => set("headers", e.target.value)}
            rows={3}
            className={`${inputCls} font-mono text-xs`}
          />
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

export const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/60 px-3 py-2 text-sm outline-none placeholder:text-[var(--fg-dim)] focus:border-[var(--accent)] disabled:opacity-40";

export function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-[var(--fg-dim)]">{hint}</p>}
    </label>
  );
}
