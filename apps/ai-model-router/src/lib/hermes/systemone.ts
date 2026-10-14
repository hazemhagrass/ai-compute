/**
 * Validation for `tier_router.classifier.systemone`, kept rule-for-rule with
 * hermes-agent `SystemOneConfig.from_config` (agent/systemone_router.py).
 * Hermes turns any invalid enabled block into `None` without a warning, so
 * the app must refuse to write one rather than let SystemOne silently vanish.
 */

const DEFAULTS = { timeout_s: 4, attempt_timeout_s: 1.5, min_confidence: 0.75 };
const MODEL_KEYS = ["routine_model", "escalation_model", "verdict_model"] as const;

function endpointProblem(endpoint: unknown): string | null {
  if (typeof endpoint !== "string") return "endpoint must be a string";
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return `${endpoint}: not a URL`;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return `${endpoint}: must be http or https`;
  if (!url.hostname) return `${endpoint}: missing host`;
  if (url.username || url.password) return `${endpoint}: must not embed credentials`;
  if (url.search || url.hash || endpoint.includes("?") || endpoint.includes("#")) {
    return `${endpoint}: must not have a query or fragment`;
  }
  if (url.pathname !== "/v1/systemone") return `${endpoint}: path must be /v1/systemone`;
  return null;
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** Problems Hermes would hit loading this block; empty means it loads. A
 * block that is not `enabled: true` is ignored by Hermes, so it is valid. */
export function systemOneProblems(raw: Record<string, unknown>): string[] {
  if (raw.enabled !== true) return [];
  const problems: string[] = [];

  const endpoints = raw.endpoints;
  if (!Array.isArray(endpoints) || endpoints.length < 1 || endpoints.length > 3) {
    problems.push("endpoints: 1 to 3 required when enabled");
  } else {
    for (const e of endpoints) {
      const p = endpointProblem(e);
      if (p) problems.push(p);
    }
  }

  const total = raw.timeout_s ?? DEFAULTS.timeout_s;
  const attempt = raw.attempt_timeout_s ?? DEFAULTS.attempt_timeout_s;
  const confidence = raw.min_confidence ?? DEFAULTS.min_confidence;
  const nums = { timeout_s: total, attempt_timeout_s: attempt, min_confidence: confidence };
  const bad = Object.entries(nums).filter(([, v]) => !isFiniteNumber(v));
  for (const [k] of bad) problems.push(`${k}: must be a finite number`);
  if (bad.length === 0) {
    const [t, a, c] = [total, attempt, confidence] as number[];
    if (t < 0.1 || t > 120) problems.push("timeout_s: must be between 0.1 and 120");
    if (a < 0.05 || a > t) problems.push("attempt_timeout_s: must be between 0.05 and timeout_s");
    if (c < 0.5 || c > 1) problems.push("min_confidence: must be between 0.5 and 1");
  }

  for (const key of MODEL_KEYS) {
    if (!(key in raw)) continue;
    const m = String(raw[key]);
    if (!m || m.length > 64 || m.includes("/") || m.trim() === "") {
      problems.push(`${key}: 1-64 chars, no "/"`);
    }
  }
  return problems;
}
