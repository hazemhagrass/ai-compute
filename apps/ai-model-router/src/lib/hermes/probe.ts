import "server-only";

import { catalogEntryFor } from "./catalog";
import { envValues } from "./env";
import { profilePaths } from "./paths";
import type { ProviderEntry } from "./config-schema";

export interface HermesProviderProbeResult {
  ok: boolean;
  /** True when this provider's auth type can't be probed with a plain HTTP
   * call (oauth/aws_sdk/vertex/external_process/copilot device flow) — not
   * a failure, just not testable from here. */
  notTestable: boolean;
  status: number | null;
  latencyMs: number;
  modelCount: number | null;
  error: string | null;
}

const PROBE_TIMEOUT_MS = 8000;

function redact(text: string, secret: string | undefined): string {
  let out = text;
  if (secret && secret.length >= 8) {
    out = out.split(secret).join("[REDACTED]");
  }
  return out.length > 300 ? `${out.slice(0, 300)}...` : out;
}

function extractModelCount(body: string): number | null {
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const arr = (Array.isArray(json.data) && json.data) || (Array.isArray(json.models) && json.models) || null;
    return arr ? arr.length : null;
  } catch {
    return null;
  }
}

/**
 * Probe one Hermes-managed provider's reachability + credentials by hitting
 * its OpenAI-compatible `/models` (or catalog-declared) endpoint. Only
 * `api_key`/`bearer`/`none` auth types are testable this way — everything
 * else (oauth device/external flows, aws_sdk, vertex, copilot, an external
 * process) needs Hermes's own auth machinery, so this reports
 * `notTestable: true` rather than guessing at a probe that would always
 * fail for the wrong reason.
 */
export async function probeHermesProvider(
  profileId: string,
  id: string,
  entry: ProviderEntry,
  catalogId: string,
): Promise<HermesProviderProbeResult> {
  const catalog = catalogEntryFor(catalogId);
  const notTestableAuth = new Set(["oauth_device_code", "oauth_external", "copilot", "aws_sdk", "vertex", "external_process"]);
  if (notTestableAuth.has(catalog.authType)) {
    return { ok: false, notTestable: true, status: null, latencyMs: 0, modelCount: null, error: null };
  }

  const baseUrl = entry.api ?? catalog.baseUrl;
  if (!baseUrl) {
    return { ok: false, notTestable: false, status: null, latencyMs: 0, modelCount: null, error: "no base URL configured" };
  }

  let key: string | undefined = entry.api_key;
  if (!key && catalog.envVars.length) {
    const { envPath } = profilePaths(profileId);
    const values = envValues(envPath);
    key = catalog.envVars.map((v) => values[v]).find((v) => !!v);
  }
  if (catalog.authType !== "none" && !key) {
    return { ok: false, notTestable: false, status: null, latencyMs: 0, modelCount: null, error: "no API key configured" };
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/models`;
  const headers: Record<string, string> = {};
  if (key) headers.Authorization = `Bearer ${key}`;

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, cache: "no-store" });
    const latencyMs = Date.now() - started;
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        notTestable: false,
        status: res.status,
        latencyMs,
        modelCount: null,
        error: redact(text.slice(0, 300) || res.statusText, key),
      };
    }
    return { ok: true, notTestable: false, status: res.status, latencyMs, modelCount: extractModelCount(text), error: null };
  } catch (err) {
    return {
      ok: false,
      notTestable: false,
      status: null,
      latencyMs: Date.now() - started,
      modelCount: null,
      error: redact(err instanceof Error ? err.message : String(err), key),
    };
  } finally {
    clearTimeout(timer);
  }
}
