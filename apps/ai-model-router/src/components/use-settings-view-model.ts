"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api, apiWithMeta } from "./store";
import { budgetIdFrom, keyVerifyStatus } from "./settings.rules";

export interface Subscription {
  providerId: number;
  tier: string;
  allowModels: string[];
  denyModels: string[];
  monthlyInput: number;
  monthlyOutput: number;
  monthlyBudget: number;
  notes: string;
}

export interface RoutingPolicy {
  preferLocal: boolean;
  fallbackToLocal: boolean;
  maxOutputCostPer1M: number;
  minContext: number;
  enforceEntitlements: boolean;
  strictEmpty: boolean;
  overrideWeights: Record<string, number>;
}

export interface BudgetCheck {
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

export interface BudgetRow {
  id: string;
  label: string;
  period: string;
  check: BudgetCheck;
}

export interface ProviderKey {
  id: number;
  providerId: number;
  label: string;
  keyPreview: string;
  active: boolean;
  lastVerifiedAt: string;
  lastVerifyOk: boolean;
  lastVerifyError: string;
}

export interface RetentionPolicy {
  usage: { maxAgeDays?: number; maxRows?: number };
  recommendations: { maxAgeDays?: number; maxRows?: number };
}

interface RetentionGet {
  policy: RetentionPolicy;
  autoRunIntervalMs: number | null;
}

interface RetentionPatch {
  usageMaxAgeDays: number;
  usageMaxRows: number;
  recommendationMaxAgeDays: number;
  recommendationMaxRows: number;
}

export function useSettingsViewModel({ providers }: { providers: { id: number }[] }) {
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
      const [subs, pol, bud] = await Promise.all([
        api<{ subscriptions?: Subscription[] }>("/api/subscriptions"),
        api<{ policy: RoutingPolicy }>("/api/routing-policy"),
        api<{ budgets?: BudgetRow[] }>("/api/budgets"),
      ]);
      setSubscriptions(subs.subscriptions ?? []);
      setPolicy(pol.policy);
      setBudgets(bud.budgets ?? []);
      if (selectedProvider) {
        const k = await api<{ keys?: ProviderKey[] }>(
          `/api/providers/${selectedProvider}/keys`,
        );
        setKeys(k.keys ?? []);
      } else {
        setKeys([]);
      }
    } catch (err) {
      setStatus(String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedProvider]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const saveSubscription = useCallback(
    async (sub: Partial<Subscription>) => {
      setStatus("saving subscription...");
      try {
        await api("/api/subscriptions", { method: "POST", json: sub });
        setStatus("subscription saved");
        await refresh();
      } catch (err) {
        setStatus(`error: ${err instanceof Error ? err.message : err}`);
      }
    },
    [refresh],
  );

  const updatePolicy = useCallback(
    async (patch: Partial<RoutingPolicy>) => {
      setStatus("saving policy...");
      try {
        const data = await api<{ policy: RoutingPolicy }>("/api/routing-policy", {
          method: "PATCH",
          json: patch,
        });
        setPolicy(data.policy);
        setStatus("policy saved");
      } catch (err) {
        setStatus(`error: ${err instanceof Error ? err.message : err}`);
      }
    },
    [],
  );

  const addKey = useCallback(
    async (label: string, key: string, activate: boolean) => {
      if (!selectedProvider) return;
      setStatus("adding key...");
      try {
        await api(`/api/providers/${selectedProvider}/keys`, {
          method: "POST",
          json: { label, key, activate },
        });
        setStatus("key added");
        await refresh();
      } catch (err) {
        setStatus(`error: ${err instanceof Error ? err.message : err}`);
      }
    },
    [selectedProvider, refresh],
  );

  const activateKey = useCallback(
    async (keyId: number) => {
      if (!selectedProvider) return;
      try {
        await api(`/api/providers/${selectedProvider}/keys/${keyId}/activate`, {
          method: "POST",
        });
        setStatus("activated");
        await refresh();
      } catch {
        setStatus(`error: activation failed`);
      }
    },
    [selectedProvider, refresh],
  );

  const verifyKey = useCallback(
    async (keyId: number) => {
      if (!selectedProvider) return;
      setVerifyingId(keyId);
      try {
        const { data: j, res } = await apiWithMeta<{
          certainty?: string;
          ok?: boolean;
          error?: string;
        }>(`/api/providers/${selectedProvider}/keys/${keyId}/verify`, {
          method: "POST",
          throwOnError: false,
        });
        setStatus(
          res.ok
            ? keyVerifyStatus(j, res.status).message
            : `error: ${res.status}`,
        );
        await refresh();
      } catch {
        setStatus("error: verify request failed");
        await refresh();
      } finally {
        setVerifyingId(null);
      }
    },
    [selectedProvider, refresh],
  );

  const deleteKey = useCallback(
    async (keyId: number) => {
      if (!selectedProvider) return;
      if (!confirm("Delete this key? This cannot be undone.")) return;
      try {
        await api(`/api/providers/${selectedProvider}/keys/${keyId}`, {
          method: "DELETE",
        });
        setStatus("deleted");
        await refresh();
      } catch (err) {
        setStatus(`error: ${err instanceof Error ? err.message : err}`);
      }
    },
    [selectedProvider, refresh],
  );

  const saveBudget = useCallback(
    async (label: string, period: string, limitCents: number) => {
      setStatus("saving budget...");
      const id = budgetIdFrom(label, period);
      try {
        await api("/api/budgets", {
          method: "POST",
          json: { id, label, period, limitCents },
        });
        setStatus("budget saved");
        await refresh();
      } catch (err) {
        setStatus(
          `error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [refresh],
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      if (!confirm("Delete this budget?")) return;
      try {
        await api(`/api/budgets/${encodeURIComponent(id)}`, { method: "DELETE" });
        setStatus("budget deleted");
        await refresh();
      } catch (err) {
        setStatus(`error: ${err instanceof Error ? err.message : err}`);
      }
    },
    [refresh],
  );

  const currentSub = useMemo(
    () => subscriptions.find((s) => s.providerId === selectedProvider),
    [subscriptions, selectedProvider],
  );

  const view = useMemo(
    () => ({
      selectedProvider,
      subscriptions,
      policy,
      keys,
      budgets,
      verifyingId,
      loading,
      status,
      currentSub,
    }),
    [selectedProvider, subscriptions, policy, keys, budgets, verifyingId, loading, status, currentSub],
  );

  return {
    view,
    setSelectedProvider,
    saveSubscription,
    updatePolicy,
    addKey,
    activateKey,
    verifyKey,
    deleteKey,
    saveBudget,
    deleteBudget,
    refresh,
  };
}

export function useRetentionViewModel() {
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null);
  const [autoRunIntervalMs, setAutoRunIntervalMs] = useState<number | null>(null);
  const [form, setForm] = useState<RetentionPatch>({
    usageMaxAgeDays: 30,
    usageMaxRows: 10000,
    recommendationMaxAgeDays: 30,
    recommendationMaxRows: 1000,
  });
  const [saving, setSaving] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [lastResult, setLastResult] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const json = await api<RetentionGet>("/api/retention");
        if (cancelled) return;
        setPolicy(json.policy);
        setAutoRunIntervalMs(json.autoRunIntervalMs ?? null);
        setForm({
          usageMaxAgeDays: json.policy.usage.maxAgeDays ?? 30,
          usageMaxRows: json.policy.usage.maxRows ?? 10000,
          recommendationMaxAgeDays: json.policy.recommendations.maxAgeDays ?? 30,
          recommendationMaxRows: json.policy.recommendations.maxRows ?? 1000,
        });
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const savePolicy = useCallback(async () => {
    setSaving(true);
    try {
      const json = await api<{ policy: RetentionPolicy }>("/api/retention", {
        method: "PATCH",
        json: form,
      });
      setPolicy(json.policy);
    } finally {
      setSaving(false);
    }
  }, [form]);

  const pruneNow = useCallback(async () => {
    setPruning(true);
    setLastResult("");
    try {
      const json = await api<{
        deleted?: number;
        recommendations?: { deleted?: number };
      }>("/api/retention", { method: "POST", json: {} });
      setLastResult(
        `Deleted ${json.deleted ?? 0} usage row(s), ${json.recommendations?.deleted ?? 0} recommendation(s).`,
      );
    } catch (err) {
      setLastResult(err instanceof Error ? err.message : "Prune failed");
    } finally {
      setPruning(false);
    }
  }, []);

  const view = useMemo(
    () => ({ policy, autoRunIntervalMs, form, saving, pruning, lastResult }),
    [policy, autoRunIntervalMs, form, saving, pruning, lastResult],
  );

  return {
    view,
    setForm,
    savePolicy,
    pruneNow,
  };
}
