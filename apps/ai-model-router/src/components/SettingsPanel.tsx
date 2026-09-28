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

interface BudgetCheck {
  evaluation: {
    budgetId: string;
    period: string;
    limitCents: number;
    spentCents: number;
    remainingCents: number;
    percentUsed: number;
    projectedCents: number;
    status: string;
  };
}

interface BudgetRow {
  id: string;
  label: string;
  period: string;
  limitCents: number;
  check: BudgetCheck;
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
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const [subsRes, polRes, budRes] = await Promise.all([
        fetch("/api/subscriptions"),
        fetch("/api/routing-policy"),
        fetch("/api/budgets"),
      ]);
      const subsJson = await subsRes.json();
      const polJson = await polRes.json();
      const budJson = await budRes.json();
      setSubscriptions(subsJson.subscriptions ?? []);
      setPolicy(polJson.policy);
      setBudgets(budJson.budgets ?? []);
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

  /** Probe the stored key against the provider (#169); result lands in refresh. */
  async function verifyKey(keyId: number) {
    if (!selectedProvider) return;
    setVerifyingId(keyId);
    try {
      const res = await fetch(
        `/api/providers/${selectedProvider}/keys/${keyId}/verify`,
        { method: "POST" },
      );
      if (res.ok) {
        const j = await res.json();
        setStatus(
          j.certainty === "unknown"
            ? `unverified: ${j.error ?? "transient error"}`
            : j.ok
              ? "verified ok"
              : `failed: ${j.error ?? res.status}`,
        );
      } else {
        setStatus(`error: ${res.status}`);
      }
      refresh();
    } finally {
      setVerifyingId(null);
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

  async function saveBudget(label: string, period: string, limitCents: number) {
    setStatus("saving budget...");
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || period;
    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, label, period, limitCents }),
    });
    if (res.ok) {
      setStatus("budget saved");
      refresh();
    } else {
      const j = await res.json().catch(() => ({ error: res.status }));
      setStatus(`error: ${j.error ?? res.status}`);
    }
  }

  async function deleteBudget(id: string) {
    if (!confirm("Delete this budget?")) return;
    const res = await fetch(`/api/budgets/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setStatus("budget deleted");
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

      <BudgetsSection budgets={budgets} onSave={saveBudget} onDelete={deleteBudget} />

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
              onVerify={verifyKey}
              onDelete={deleteKey}
              verifyingId={verifyingId}
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
  onVerify,
  onDelete,
  verifyingId,
}: {
  keys: ProviderKey[];
  onAdd: (label: string, key: string, activate: boolean) => void;
  onActivate: (id: number) => void;
  onVerify: (id: number) => void;
  onDelete: (id: number) => void;
  verifyingId: number | null;
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
            <th className="pb-2 text-left">Check</th>
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
                {k.active && k.lastVerifiedAt && !k.lastVerifyOk && (
                  // The sneaky case: the models-endpoint probe passes but the
                  // key is revoked -- the provider health dot cannot see this,
                  // only a real key verification can.
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" aria-label="active key failed verification" />
                )}
                <button
                  onClick={() => onVerify(k.id)}
                  disabled={verifyingId !== null}
                  className="text-xs text-[var(--accent)] hover:underline disabled:opacity-40"
                >
                  {verifyingId === k.id ? "verifying..." : "verify"}
                </button>
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


function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Budgets with live status (issues #158/#164): definition + usage strip in one
 * line each, so the state that refuses a call is visible in the same place it
 * is configured. A strip turns warning (>= 80 percent) amber and exceeded red;
 * the same thresholds the call gate (#163) enforces, so what the user sees
 * here is exactly what governs the next request.
 */
function BudgetsSection({
  budgets,
  onSave,
  onDelete,
}: {
  budgets: BudgetRow[];
  onSave: (label: string, period: string, limitCents: number) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [dollars, setDollars] = useState(10);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/60 p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
        Budgets
      </h3>

      {budgets.length === 0 ? (
        <p className="text-sm text-[var(--fg-dim)]">
          No budgets. Calls are unthrottled until one is set.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-[var(--fg-dim)]">
            <tr>
              <th className="pb-2 text-left">Budget</th>
              <th className="pb-2 text-left">Period</th>
              <th className="pb-2 text-left">Spent</th>
              <th className="pb-2 text-left">Status</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => {
              const ev = b.check.evaluation;
              const warn = ev.status === "warning" || ev.status === "exceeded";
              return (
                <tr key={b.id} className="border-t border-[var(--border)]">
                  <td className="py-2">
                    {b.label || b.id}
                    <div className="text-xs text-[var(--fg-dim)]">
                      {money(ev.spentCents)} of {money(ev.limitCents)}
                    </div>
                  </td>
                  <td className="py-2 text-xs">{ev.period}</td>
                  <td className="py-2 text-xs">{Math.round(ev.percentUsed)}%</td>
                  <td className="py-2">
                    <span
                      className={
                        ev.status === "exceeded"
                          ? "rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400"
                          : warn
                            ? "rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400"
                            : "rounded bg-green-500/15 px-2 py-0.5 text-xs text-green-500"
                      }
                    >
                      {ev.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => onDelete(b.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(label || period, period, Math.round(dollars * 100));
          setLabel("");
        }}
        className="mt-3 grid gap-2 rounded-md border border-dashed border-[var(--border)] p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (defaults to period)"
          className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-sm"
        />
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-sm"
        >
          <option value="daily">daily</option>
          <option value="weekly">weekly</option>
          <option value="monthly">monthly</option>
        </select>
        <input
          type="number"
          min={0}
          step={1}
          value={dollars}
          onChange={(e) => setDollars(Number(e.target.value))}
          className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[#06070c]"
        >
          Add budget
        </button>
      </form>
    </section>
  );
}
