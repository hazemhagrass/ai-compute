"use client";

import { useState } from "react";

import type { Provider } from "@/lib/types";
import { money, parseModelList, budgetStatusTone } from "./settings.rules";
import {
  useRetentionViewModel,
  useSettingsViewModel,
  type BudgetRow,
  type ProviderKey,
  type Subscription,
} from "./use-settings-view-model";

export default function SettingsPanel({ providers }: { providers: Provider[] }) {
  const vm = useSettingsViewModel({
    providers: providers.map((p) => ({ id: p.id })),
  });
  const { view } = vm;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-[var(--fg-muted)]">
            Subscriptions, routing policy, and per-provider keys.
          </p>
        </div>
        {view.status && (
          <span className="text-xs text-[var(--fg-dim)]">{view.status}</span>
        )}
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/60 p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
          Routing policy
        </h3>
        {view.policy && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-2 text-sm">
              Prefer local models
              <input
                type="checkbox"
                checked={view.policy.preferLocal}
                onChange={(e) => vm.updatePolicy({ preferLocal: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Fallback to local when unreachable
              <input
                type="checkbox"
                checked={view.policy.fallbackToLocal}
                onChange={(e) =>
                  vm.updatePolicy({ fallbackToLocal: e.target.checked })
                }
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Enforce entitlements
              <input
                type="checkbox"
                checked={view.policy.enforceEntitlements}
                onChange={(e) =>
                  vm.updatePolicy({ enforceEntitlements: e.target.checked })
                }
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-sm">
              Fail loudly on empty result
              <input
                type="checkbox"
                checked={view.policy.strictEmpty}
                onChange={(e) => vm.updatePolicy({ strictEmpty: e.target.checked })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Max output $/1M tokens (0 = no cap)</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={view.policy.maxOutputCostPer1M}
                onChange={(e) =>
                  vm.updatePolicy({ maxOutputCostPer1M: Number(e.target.value) })
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
                value={view.policy.minContext}
                onChange={(e) => vm.updatePolicy({ minContext: Number(e.target.value) })}
                className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
              />
            </label>
          </div>
        )}
      </section>

      <BudgetsSection
        budgets={view.budgets}
        onSave={vm.saveBudget}
        onDelete={vm.deleteBudget}
      />

      <RetentionSection />

      <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
            Per-provider settings
          </h3>
          <select
            value={view.selectedProvider ?? ""}
            onChange={(e) => vm.setSelectedProvider(Number(e.target.value))}
            className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-sm"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {view.loading && <p className="text-sm text-[var(--fg-dim)]">loading...</p>}

        {view.selectedProvider && !view.loading && (
          <div className="space-y-6">
            <SubscriptionForm
              key={`sub-${view.selectedProvider}-${view.currentSub?.tier ?? "none"}-${view.currentSub?.monthlyBudget ?? 0}`}
              providerId={view.selectedProvider}
              value={view.currentSub}
              onSave={vm.saveSubscription}
            />
            <KeysList
              keys={view.keys}
              onAdd={vm.addKey}
              onActivate={vm.activateKey}
              onVerify={vm.verifyKey}
              onDelete={vm.deleteKey}
              verifyingId={view.verifyingId}
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
          allowModels: parseModelList(allow),
          denyModels: parseModelList(deny),
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
                      k.lastVerifyOk ? "text-green-500" : "text-red-500"
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
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400"
                    aria-label="active key failed verification"
                  />
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
              const tone = budgetStatusTone(
                ev.status === "ok" && ev.percentUsed >= 80 ? "warning" : ev.status,
              );
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
                    <span className={tone.cls}>{tone.label}</span>
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

function RetentionSection() {
  const vm = useRetentionViewModel();
  const { view } = vm;
  const { form } = view;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--fg-dim)]">
          Retention
        </h3>
        {view.autoRunIntervalMs !== null && (
          <span className="text-xs text-[var(--fg-dim)]">
            auto-runs every {Math.round(view.autoRunIntervalMs / 60000)}min
          </span>
        )}
      </div>

      {view.policy && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Usage log max age (days)</span>
            <input
              type="number"
              min={1}
              value={form.usageMaxAgeDays}
              onChange={(e) =>
                vm.setForm((f) => ({ ...f, usageMaxAgeDays: Number(e.target.value) }))
              }
              className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Usage log max rows</span>
            <input
              type="number"
              min={1}
              value={form.usageMaxRows}
              onChange={(e) =>
                vm.setForm((f) => ({ ...f, usageMaxRows: Number(e.target.value) }))
              }
              className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Recommendation history max age (days)</span>
            <input
              type="number"
              min={1}
              value={form.recommendationMaxAgeDays}
              onChange={(e) =>
                vm.setForm((f) => ({
                  ...f,
                  recommendationMaxAgeDays: Number(e.target.value),
                }))
              }
              className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Recommendation history max rows</span>
            <input
              type="number"
              min={1}
              value={form.recommendationMaxRows}
              onChange={(e) =>
                vm.setForm((f) => ({
                  ...f,
                  recommendationMaxRows: Number(e.target.value),
                }))
              }
              className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1"
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={vm.savePolicy}
          disabled={view.saving}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-[#06070c] disabled:opacity-50"
        >
          {view.saving ? "Saving..." : "Save policy"}
        </button>
        <button
          onClick={vm.pruneNow}
          disabled={view.pruning}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--panel-2)] disabled:opacity-50"
        >
          {view.pruning ? "Pruning..." : "Prune now"}
        </button>
        {view.lastResult && (
          <span className="text-xs text-[var(--fg-dim)]">{view.lastResult}</span>
        )}
      </div>
    </section>
  );
}
