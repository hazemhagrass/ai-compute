import "server-only";

// In-process per-client rate limiting for /api/auth/login. Keyed by client IP
// because the app has a single password and no usernames. Intentionally memory
// only: restarts clear the map, which is acceptable for a single-instance app
// because the persisted global account lockout in auth.ts still applies.
//
// When no trusted proxy is configured (AMR_TRUSTED_PROXY_HOPS unset/0), every
// client shares the single "direct" bucket: X-Forwarded-For and X-Real-IP are
// ignored because they are client-controlled and would let an attacker spoof a
// key to escape lockout or lock out a victim's IP.

export const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
export const LOGIN_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_KEYS = 1000;

interface FailureEntry {
  count: number;
  until: number;
  lastFailureAt: number;
}

const attempts = new Map<string, FailureEntry>();

function trustedProxyHops(): number {
  const raw = process.env.AMR_TRUSTED_PROXY_HOPS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

export function clientKeyFromRequest(request: Request): string {
  const hops = trustedProxyHops();
  if (hops === 0) return "direct";

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    // Counting from the right: hops=1 => last entry.
    if (parts.length >= hops) {
      const idx = parts.length - hops;
      const entry = parts[idx];
      if (entry) return entry;
    }
  }
  return "direct";
}

export function clientLockoutRemainingMs(key: string): number {
  const entry = attempts.get(key);
  if (!entry) return 0;

  // Reset stale low failure counts: if the last failure is older than the
  // cooldown window, the counter has expired.
  if (entry.until === 0 && Date.now() - entry.lastFailureAt > LOGIN_RATE_LIMIT_COOLDOWN_MS) {
    attempts.delete(key);
    return 0;
  }

  const remaining = entry.until - Date.now();
  if (entry.until > 0 && remaining <= 0) {
    attempts.delete(key);
    return 0;
  }
  return Math.max(0, remaining);
}

export function recordClientFailure(key: string): void {
  clientLockoutRemainingMs(key);
  const now = Date.now();
  const entry = attempts.get(key);
  let count = 1;
  let until = 0;
  if (entry && now - entry.lastFailureAt <= LOGIN_RATE_LIMIT_COOLDOWN_MS) {
    count = entry.count + 1;
    until = entry.until;
  }
  if (count >= LOGIN_RATE_LIMIT_MAX_FAILURES) {
    until = now + LOGIN_RATE_LIMIT_COOLDOWN_MS;
  }
  attempts.set(key, { count, until, lastFailureAt: now });

  if (attempts.size > MAX_KEYS) pruneOldest();
}

export function clearClientFailures(key: string): void {
  attempts.delete(key);
}

function pruneOldest(): void {
  for (const [key, entry] of attempts) {
    if (entry.until <= Date.now()) attempts.delete(key);
    if (attempts.size <= MAX_KEYS) return;
  }
  for (const key of attempts.keys()) {
    attempts.delete(key);
    if (attempts.size <= MAX_KEYS) return;
  }
}

export function resetClientRateLimits(): void {
  attempts.clear();
}
