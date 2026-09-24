"use client";

/**
 * Settings panel (issue #158): one screen where the user actually owns their
 * router. Three sections in one place, because they only make sense together:
 *
 *   Subscriptions  what the user is entitled to call at each provider (#153)
 *   Routing policy the knobs that shape ranking, in a typed shape (#155)
 *   Keys per provider - stored, activated, verified (#156)
 *
 * The panel deliberately does not try to be the sole surface for providers or
 * models. Those live on their own tabs. This panel is the *policy* view.
 */
import { useCallback, useEffect, useState } from "react";

import type { Provider } from "@/lib/types";

interface Subscription {
  providerId: number;
  tier: string;
  allowModels: string[];
  denyModels: string[];
  monthlyInput: number;
  monthlyOutput: number;
  monthlyBudget: number;
  notes: string;
}

interface RoutingPolicy {
  preferLocal: boolean;
  fallbackToLocal: boolean;
  maxOutputCostPer1M: number;
  minContext: number;
  enforceEntitlements: boolean;
  strictEmpty: boolean;
  overrideWeights: Record<string, number>;
}

interface ProviderKey {
  id: number;
  providerId: number;
  label: string;
  keyPreview: string;
  active: boolean;
  lastVerifiedAt: string;
  lastVerifyOk: boolean;
  lastVerifyError: string;
}

export default function SettingsPanel({ providers }: { providers: Provider[] }) {
  const [selectedProvider, setSelectedProvider] = useState<number | null>(
    providers[0]?.id ?? null,
  );
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [policy, setPolicy] = useState<RoutingPolicy | null>(null);
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const [subsRes, polRes] = await Promise.all([
        fetch("/api/subscriptions"),
        fetch("/api/routing-policy"),
      ]);
      const subsJson = await subsRes.json();
      const polJson = await polRes.json();
      setSubscriptions(subsJson.subscriptions ?? []);
      setPolicy(polJson.policy);
      if (selectedProvider) {
        const kRes = await fetch(`/api/providers/${selectedProvider}/keys`);
        const kJson = await kRes.json();
        setKeys(kJson.keys ?? []);
      } else {
        setKeys([]);
      }
    } catch (err) {
      setStatus(String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedProvider]);

  // Load subscriptions/policy on mount and when the selected provider changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function saveSubscription(sub: Partial<Subscription>) {
    setStatus("saving subscription...");
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sub),
    });
    if (res.ok) {
      setStatus("subscription saved");
      refresh();
    } else {
      setStatus(`error: ${res.status}`);
    }
  }

  async function updatePolicy(patch: Partial<RoutingPolicy>) {
    setStatus("saving policy...");
    const res = await fetch("/api/routing-policy", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setPolicy(data.policy);
      setStatus("policy saved");
    } else {
      setStatus(`error: ${res.status}`);
    }
  }

  async function addKey(label: string, key: string, activate: boolean) {
    if (!selectedProvider) return;
    setStatus("adding key...");
    const res = await fetch(`/api/providers/${selectedProvider}/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, key, activate }),
    });
    if (res.ok) {
      setStatus("key added");
      refresh();
    } else {
      setStatus(`error: ${res.status}`);
    }
  }

  async function activateKey(keyId: number) {
    if (!selectedProvider) return;
    const res = await fetch(
      `/api/providers/${selectedProvider}/keys/${keyId}/activate`,
      { method: "POST" },
    );
    if (res.ok) {
      setStatus("activated");
      refresh();
    }
  }

  async function deleteKey(keyId: number) {
    if (!selectedProvider) return;
    if (!confirm("Delete this key? This cannot be undone.")) return;
    const res = await fetch(
      `/api/providers/${selectedProvider}/keys/${keyId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setStatus("deleted");
      refresh();
    }
  }

  const currentSub = subscriptions.find((s) => s.providerId === selectedProvider);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-[var(--fg-muted)]">
            Subscriptions, routing policy, and per-provider keys.
          </p>
        </div>
        {status && (
          <span className="text-xs text-[var(--fg-dim)]">{status}</span>
        )}
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/60 p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
          Routing policy
        </h3>
        {policy && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-2 text-sm">
              Prefer local models
              <input
                type="checkbox"
                checked={policy.preferLocal}
                onChange={(e) => updatePolicy({ preferLocal: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Fallback to local when unreachable
              <input
                type="checkbox"
                checked={policy.fallbackToLocal}
                onChange={(e) => updatePolicy({ fallbackToLocal: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Enforce entitlements
              <input
                type="checkbox"
                checked={policy.enforceEntitlements}
                onChange={(e) =>
                  updatePolicy({ enforceEntitlements: e.target.checked })
                }
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Fail loudly on empty result
              <input
                type="checkbox"
                checked={policy.strictEmpty}
                onChange={(e) => updatePolicy({ strictEmpty: e.target.checked })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Max output $/1M tokens (0 = no cap)</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={policy.maxOutputCostPer1M}
                onChange={(e) =>
                  updatePolicy({ maxOutputCostPer1M: Number(e.target.value) })
                }
                className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Minimum context window (tokens)</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={policy.minContext}
                onChange={(e) =>
                  updatePolicy({ minContext: Number(e.target.value) })
                }
                className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
              />
            </label>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
            Per-provider settings
          </h3>
          <select
            value={selectedProvider ?? ""}
            onChange={(e) => setSelectedProvider(Number(e.target.value))}
            className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-sm"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="text-sm text-[var(--fg-dim)]">loading...</p>}

        {selectedProvider && !loading && (
          <div className="space-y-6">
            <SubscriptionForm
              key={`sub-${selectedProvider}-${currentSub?.tier ?? "none"}-${currentSub?.monthlyBudget ?? 0}`}
              providerId={selectedProvider}
              value={currentSub}
              onSave={saveSubscription}
            />
            <KeysList
              keys={keys}
              onAdd={addKey}
              onActivate={activateKey}
              onDelete={deleteKey}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function SubscriptionForm({
  providerId,
  value,
  onSave,
}: {
  providerId: number;
  value?: Subscription;
  onSave: (sub: Partial<Subscription>) => void;
}) {
  const [tier, setTier] = useState(value?.tier ?? "free");
  const [budget, setBudget] = useState(value?.monthlyBudget ?? 0);
  const [allow, setAllow] = useState((value?.allowModels ?? []).join(", "));
  const [deny, setDeny] = useState((value?.denyModels ?? []).join(", "));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          providerId,
          tier,
          monthlyBudget: budget,
          allowModels: allow
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          denyModels: deny
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      }}
      className="space-y-3"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
        Subscription
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>Tier</span>
          <input
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Monthly budget (USD, 0 = none)</span>
          <input
            type="number"
            min={0}
            step={5}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span>Allow-list (comma-separated model ids; empty = all allowed)</span>
        <input
          value={allow}
          onChange={(e) => setAllow(e.target.value)}
          placeholder="gpt-4o, gpt-4o-mini"
          className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Deny-list (comma-separated model ids)</span>
        <input
          value={deny}
          onChange={(e) => setDeny(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[#06070c]"
      >
        Save subscription
      </button>
    </form>
  );
}

function KeysList({
  keys,
  onAdd,
  onActivate,
  onDelete,
}: {
  keys: ProviderKey[];
  onAdd: (label: string, key: string, activate: boolean) => void;
  onActivate: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [label, setLabel] = useState("");
  const [rawKey, setRawKey] = useState("");
  const [makeActive, setMakeActive] = useState(true);

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
        API keys ({keys.length})
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-[var(--fg-dim)]">
          <tr>
            <th className="pb-2 text-left">Label</th>
            <th className="pb-2 text-left">Preview</th>
            <th className="pb-2 text-left">Verified</th>
            <th className="pb-2 text-left">Active</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id} className="border-t border-[var(--border)]">
              <td className="py-2">{k.label || "(unlabelled)"}</td>
              <td className="py-2 font-mono text-xs">{k.keyPreview}</td>
              <td className="py-2 text-xs">
                {k.lastVerifiedAt ? (
                  <span
                    className={
                      k.lastVerifyOk
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  >
                    {k.lastVerifyOk ? "ok" : k.lastVerifyError.slice(0, 40)}
                  </span>
                ) : (
                  <span className="text-[var(--fg-dim)]">never</span>
                )}
              </td>
              <td className="py-2">
                {k.active ? (
                  <span className="rounded bg-[var(--accent)]/20 px-2 py-0.5 text-xs">
                    active
                  </span>
                ) : (
                  <button
                    onClick={() => onActivate(k.id)}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    activate
                  </button>
                )}
              </td>
              <td className="py-2 text-right">
                <button
                  onClick={() => onDelete(k.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(label, rawKey, makeActive);
          setLabel("");
          setRawKey("");
        }}
        className="grid gap-2 rounded-md border border-dashed border-[var(--border)] p-3 sm:grid-cols-[1fr_2fr_auto_auto]"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (personal, work)"
          className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-sm"
        />
        <input
          type="password"
          value={rawKey}
          onChange={(e) => setRawKey(e.target.value)}
          placeholder="Key (never displayed after save)"
          className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-sm"
          required
        />
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={makeActive}
            onChange={(e) => setMakeActive(e.target.checked)}
          />
          activate
        </label>
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[#06070c]"
        >
          Add key
        </button>
      </form>
    </div>
  );
}
