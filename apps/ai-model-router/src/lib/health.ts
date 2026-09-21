import "server-only";

import { redactSecrets, testConnection } from "./client";
import { listProviders } from "./repo";
import type { Provider } from "./types";

/** How many provider probes may run at the same time. */
export const HEALTH_CONCURRENCY = 5;

/** Per-probe deadline, so one hung endpoint cannot stall the dashboard. */
export const HEALTH_PROBE_TIMEOUT_MS = 8000;

export interface ProviderHealth {
  id: number;
  name: string;
  ok: boolean;
  latencyMs: number;
  modelCount: number | null;
  status: number | null;
  error: string | null;
}

export interface HealthReport {
  checkedAt: string;
  durationMs: number;
  okCount: number;
  total: number;
  results: ProviderHealth[];
}

function sanitizeError(raw: string): string {
  // testConnection already runs redactSecrets with the provider key, so the
  // key is gone here. This pass just caps a full upstream body (HTML error
  // pages, stack traces) before it reaches the UI.
  let msg = redactSecrets(raw);
  if (msg.length > 200) msg = `${msg.slice(0, 200)}...`;
  return msg.replace(/\s+/g, " ").trim();
}

async function probeProvider(p: Provider): Promise<ProviderHealth> {
  const base = { id: p.id, name: p.name };
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
    // testConnection is not supposed to throw, but a thrown error must still
    // degrade to a row rather than fail the whole dashboard.
    const raw = err instanceof Error ? err.message : String(err);
    return { ...base, ok: false, latencyMs: 0, modelCount: null, status: null, error: sanitizeError(raw) };
  }
}

/**
 * Run `probe` over `providers` with at most `limit` in flight. Results keep
 * the input order, and every provider gets a row even when its probe throws.
 */
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

/** Test every configured provider and aggregate the per-provider status. */
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
