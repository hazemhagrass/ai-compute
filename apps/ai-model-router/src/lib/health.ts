import "server-only";

import { redactSecrets, testConnection } from "./client";
import { listProviderKeys } from "./provider-keys";
import { listProviders } from "./repo";
import type { Provider } from "./types";

export const HEALTH_CONCURRENCY = 5;

export const HEALTH_PROBE_TIMEOUT_MS = 8000;

export interface ProviderHealth {
  id: number;
  name: string;
  ok: boolean;
  latencyMs: number;
  modelCount: number | null;
  status: number | null;
  error: string | null;
  keyAudit: {
    activePreview: string | null;
    lastVerifiedAt: string | null;
    lastVerifyOk: boolean | null;
  } | null;
}

export interface HealthReport {
  checkedAt: string;
  durationMs: number;
  okCount: number;
  total: number;
  results: ProviderHealth[];
}

function sanitizeError(raw: string): string {
  let msg = redactSecrets(raw);
  if (msg.length > 200) msg = `${msg.slice(0, 200)}...`;
  return msg.replace(/\s+/g, " ").trim();
}

function keyAuditFor(providerId: number): ProviderHealth["keyAudit"] {
  const keys = listProviderKeys(providerId);
  if (keys.length === 0) return null;
  const active = keys.find((k) => k.active) ?? null;
  return {
    activePreview: active?.keyPreview ?? null,
    lastVerifiedAt: active?.lastVerifiedAt ? active.lastVerifiedAt : null,
    lastVerifyOk: active ? active.lastVerifyOk : null,
  };
}

async function probeProvider(p: Provider): Promise<ProviderHealth> {
  const base = { id: p.id, name: p.name, keyAudit: keyAuditFor(p.id) };
  if (p.authType !== "none" && !p.hasKey) {
    return { ...base, ok: false, latencyMs: 0, modelCount: null, status: null, error: "no API key configured" };
  }
  try {
    const r = await testConnection(p, HEALTH_PROBE_TIMEOUT_MS);
    return {
      ...base,
      ok: r.ok,
      latencyMs: r.latencyMs,
      modelCount: r.modelCount ?? null,
      status: r.status,
      error: r.ok ? null : sanitizeError(r.error ?? "connection failed"),
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ...base, ok: false, latencyMs: 0, modelCount: null, status: null, error: sanitizeError(raw) };
  }
}

export async function runHealthChecks<T>(
  providers: Provider[],
  probe: (p: Provider) => Promise<T>,
  limit = HEALTH_CONCURRENCY,
): Promise<T[]> {
  const results: T[] = new Array(providers.length) as T[];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < providers.length) {
      const i = next;
      next += 1;
      results[i] = await probe(providers[i]);
    }
  }
  const lanes = Math.max(1, Math.min(limit, providers.length));
  await Promise.all(Array.from({ length: lanes }, () => worker()));
  return results;
}

export async function checkAllProviders(): Promise<HealthReport> {
  const started = performance.now();
  const providers = listProviders().filter((p) => p.enabled);
  const results = await runHealthChecks(providers, probeProvider);
  return {
    checkedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    okCount: results.filter((r) => r.ok).length,
    total: results.length,
    results,
  };
}
