"use client";

import { useMemo, useState } from "react";

import { Field, inputCls } from "./ProvidersPanel";
import { api } from "./store";
import { Card, Empty, fmtNum, fmtUsd } from "./ui";
import type { Model, Provider } from "@/lib/types";

const SKILL_AXES = [
  "reasoning",
  "planning",
  "coding",
  "codeReview",
  "debugging",
  "longContext",
  "instruction",
  "creative",
  "math",
  "multilingual",
  "agentic",
  "extraction",
  "summarization",
  "vision",
];

const FEATURES = [
  ["tools", "Tool calling"],
  ["vision", "Vision"],
  ["json", "JSON mode"],
  ["streaming", "Streaming"],
  ["reasoning", "Reasoning"],
  ["audio", "Audio"],
  ["embedding", "Embedding"],
] as const;

export default function ModelsPanel({
  providers,
  models,
  onToast,
  onRefresh,
}: {
  providers: Provider[];
  models: Model[];
  onToast: (m: string, t?: "info" | "good" | "bad") => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<Model | "new" | null>(null);
  const [filter, setFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState<number | "all">("all");
  const [syncing, setSyncing] = useState(false);

  const shown = useMemo(
    () =>
      models.filter((m) => {
        if (providerFilter !== "all" && m.providerId !== providerFilter) return false;
        if (!filter) return true;
        const q = filter.toLowerCase();
        return (
          m.label.toLowerCase().includes(q) ||
          m.modelId.toLowerCase().includes(q) ||
          m.providerName.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
        );
      }),
    [models, filter, providerFilter],
  );

  async function syncPrices(apply: boolean) {
    setSyncing(true);
    try {
      const res = await api<{
        matches: { changed: boolean }[];
        unmatched: string[];
        applied: number;
        catalogSize: number;
        cheapnessUpdated: number;
      }>("/api/pricing", {
        method: "POST",
        json: { apply, recalcCheapness: true },
      });
      const changed = res.matches.filter((m) => m.changed).length;
      if (apply) {
        onToast(
          `Updated ${res.applied} prices + ${res.cheapnessUpdated} cheapness scores from OpenRouter`,
          "good",
        );
        onRefresh();
      } else {
        onToast(
          `${changed} of ${res.matches.length} matched models have stale prices (catalog: ${res.catalogSize})`,
          "info",
        );
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Price sync failed", "bad");
    } finally {
      setSyncing(false);
    }
  }

  async function toggle(m: Model) {
    await api(`/api/models/${m.id}`, { method: "PATCH", json: { enabled: !m.enabled } });
    onRefresh();
  }

  async function remove(m: Model) {
    if (!confirm(`Delete "${m.label}"?`)) return;
    await api(`/api/models/${m.id}`, { method: "DELETE" });
    onToast("Model deleted", "good");
    onRefresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter models, providers, tags…"
          className="min-w-[14rem] flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 px-4 py-2.5 text-sm outline-none placeholder:text-[var(--fg-dim)] focus:border-[var(--accent)]"
        />
        <select
          value={providerFilter}
          onChange={(e) =>
            setProviderFilter(e.target.value === "all" ? "all" : Number(e.target.value))
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
        <button
          onClick={() => syncPrices(false)}
          disabled={syncing}
          className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm hover:bg-[var(--panel-2)] disabled:opacity-50"
        >
          {syncing ? "Checking…" : "Check prices"}
        </button>
        <button
          onClick={() => syncPrices(true)}
          disabled={syncing}
          className="rounded-xl border border-[var(--accent)]/50 px-4 py-2.5 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50"
        >
          Sync from OpenRouter
        </button>
        <button
          onClick={() => setEditing("new")}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#06070c] hover:opacity-90"
        >
          + Add model
        </button>
      </div>

      {editing && (
        <ModelForm
          model={editing === "new" ? undefined : editing}
          providers={providers}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onRefresh();
            onToast("Model saved", "good");
          }}
          onToast={onToast}
        />
      )}

      <Card
        title={`${shown.length} models`}
        subtitle="Scores drive the router. Edit them to match your own experience."
      >
        {shown.length === 0 ? (
          <Empty>No models match. Add one, or import from a provider.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-xs">
              <thead className="text-[var(--fg-dim)]">
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-2 pb-2 font-medium">Model</th>
                  <th className="px-2 pb-2 font-medium">Provider</th>
                  <th className="px-2 pb-2 text-right font-medium">Quality</th>
                  <th className="px-2 pb-2 text-right font-medium">Speed</th>
                  <th className="px-2 pb-2 text-right font-medium">Cheap</th>
                  <th className="px-2 pb-2 text-right font-medium">Context</th>
                  <th className="px-2 pb-2 text-right font-medium">$/1M in·out</th>
                  <th className="px-2 pb-2 font-medium">Features</th>
                  <th className="px-2 pb-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr
                    key={m.id}
                    className={`border-b border-[var(--border-soft)] hover:bg-[var(--panel-2)]/40 ${
                      m.enabled ? "" : "opacity-45"
                    }`}
                  >
                    <td className="px-2 py-2.5">
                      <div className="font-medium">{m.label}</div>
                      <div className="font-mono text-[10px] text-[var(--fg-dim)]">
                        {m.modelId}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-[var(--fg-muted)]">
                      {m.providerName}
                    </td>
                    <ScoreCell v={m.quality} />
                    <ScoreCell v={m.speed} />
                    <ScoreCell v={m.cheapness} />
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[var(--fg-muted)]">
                      {fmtNum(m.contextWindow)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums text-[var(--fg-muted)]">
                      {m.inputCost === 0 && m.outputCost === 0
                        ? "free"
                        : `${fmtUsd(m.inputCost)}·${fmtUsd(m.outputCost)}`}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {FEATURES.filter(([k]) => m.features[k]).map(([k]) => (
                          <span
                            key={k}
                            className="rounded bg-[var(--panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--fg-dim)]"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={() => toggle(m)}
                          title="Enabled"
                          className="h-3.5 w-3.5 accent-[var(--accent)]"
                        />
                        <button
                          onClick={() => setEditing(m)}
                          className="rounded border border-[var(--border)] px-2 py-1 hover:bg-[var(--panel-2)]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(m)}
                          className="rounded border border-[var(--bad)]/40 px-2 py-1 text-[var(--bad)] hover:bg-[var(--bad)]/10"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ScoreCell({ v }: { v: number }) {
  const color = v >= 85 ? "var(--good)" : v >= 65 ? "var(--accent)" : v >= 45 ? "var(--warn)" : "var(--fg-dim)";
  return (
    <td className="px-2 py-2.5 text-right">
      <span className="font-mono tabular-nums" style={{ color }}>
        {Math.round(v)}
      </span>
    </td>
  );
}

function ModelForm({
  model,
  providers,
  onCancel,
  onSaved,
  onToast,
}: {
  model?: Model;
  providers: Provider[];
  onCancel: () => void;
  onSaved: () => void;
  onToast: (m: string, t?: "info" | "good" | "bad") => void;
}) {
  const [f, setF] = useState({
    providerId: model?.providerId ?? providers[0]?.id ?? 0,
    modelId: model?.modelId ?? "",
    label: model?.label ?? "",
    quality: model?.quality ?? 60,
    speed: model?.speed ?? 60,
    cheapness: model?.cheapness ?? 60,
    contextWindow: model?.contextWindow ?? 0,
    maxOutput: model?.maxOutput ?? 0,
    inputCost: model?.inputCost ?? 0,
    outputCost: model?.outputCost ?? 0,
    tags: (model?.tags ?? []).join(", "),
    notes: model?.notes ?? "",
  });
  const [skills, setSkills] = useState<Record<string, number>>(model?.skills ?? {});
  const [features, setFeatures] = useState<Record<string, boolean>>(
    model?.features ?? { tools: true, json: true, streaming: true },
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.modelId.trim()) {
      onToast("Model ID is required", "bad");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...f,
        providerId: Number(f.providerId),
        quality: Number(f.quality),
        speed: Number(f.speed),
        cheapness: Number(f.cheapness),
        contextWindow: Number(f.contextWindow),
        maxOutput: Number(f.maxOutput),
        inputCost: Number(f.inputCost),
        outputCost: Number(f.outputCost),
        tags: f.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        skills,
        features,
      };
      if (model) await api(`/api/models/${model.id}`, { method: "PATCH", json: payload });
      else await api("/api/models", { method: "POST", json: payload });
      onSaved();
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Save failed", "bad");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title={model ? `Edit ${model.label}` : "New model"}
      className="border-[var(--accent)]/40"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Provider">
          <select
            value={f.providerId}
            onChange={(e) => set("providerId", Number(e.target.value))}
            className={inputCls}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Model ID" hint="exact string the API expects">
          <input
            value={f.modelId}
            onChange={(e) => set("modelId", e.target.value)}
            placeholder="gpt-5.2"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="Display label">
          <input
            value={f.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="GPT-5.2"
            className={inputCls}
          />
        </Field>

        <Field label="Context window (tokens)">
          <input
            value={f.contextWindow}
            onChange={(e) => set("contextWindow", Number(e.target.value) || 0)}
            inputMode="numeric"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="Input $ / 1M tokens">
          <input
            value={f.inputCost}
            onChange={(e) => set("inputCost", Number(e.target.value) || 0)}
            inputMode="decimal"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="Output $ / 1M tokens">
          <input
            value={f.outputCost}
            onChange={(e) => set("outputCost", Number(e.target.value) || 0)}
            inputMode="decimal"
            className={`${inputCls} font-mono`}
          />
        </Field>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
            Headline scores
          </h4>
          <div className="space-y-3">
            {(["quality", "speed", "cheapness"] as const).map((k) => (
              <Slider
                key={k}
                label={k}
                value={f[k]}
                onChange={(v) => set(k, v)}
              />
            ))}
          </div>

          <h4 className="mb-3 mt-5 text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
            Capabilities
          </h4>
          <div className="flex flex-wrap gap-2">
            {FEATURES.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFeatures((s) => ({ ...s, [k]: !s[k] }))}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  features[k]
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]">
            Per-skill scores (0 = unknown, falls back to quality)
          </h4>
          <div className="max-h-[18rem] space-y-2 overflow-auto pr-1">
            {SKILL_AXES.map((axis) => (
              <Slider
                key={axis}
                label={axis}
                value={skills[axis] ?? 0}
                onChange={(v) => setSkills((s) => ({ ...s, [axis]: v }))}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Tags" hint="comma separated">
          <input
            value={f.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="frontier, coding, local"
            className={inputCls}
          />
        </Field>
        <Field label="Notes">
          <input
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save model"}
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

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-[11px]">
        <span className="capitalize">{label.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
        <span className="font-mono tabular-nums text-[var(--fg-dim)]">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}
