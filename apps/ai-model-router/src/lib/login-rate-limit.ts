import "server-only";

// In-process per-client rate limiting for /api/auth/login. Keyed by client IP
// because the app has a single password and no usernames. Intentionally memory
// only: restarts clear the map, which is acceptable for a single-instance app
// because the persisted global account lockout in auth.ts still applies.

export const LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
export const LOGIN_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_KEYS = 1000;

interface FailureEntry {
  count: number;
  until: number;
}

const attempts = new Map<string, FailureEntry>();

export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "direct";
}

export function clientLockoutRemainingMs(key: string): number {
  const entry = attempts.get(key);
  if (!entry) return 0;

  // until 0 means the client has failures but no active cooldown yet.
  const remaining = entry.until - Date.now();
  if (entry.until > 0 && remaining <= 0) {
    attempts.delete(key);
    return 0;
  }
  return Math.max(0, remaining);
}

export function recordClientFailure(key: string): void {
  clientLockoutRemainingMs(key);
  const entry = attempts.get(key) ?? { count: 0, until: 0 };
  const count = entry.count + 1;
  if (count >= LOGIN_RATE_LIMIT_MAX_FAILURES) {
    attempts.set(key, { count, until: Date.now() + LOGIN_RATE_LIMIT_COOLDOWN_MS });
  } else {
    attempts.set(key, { count, until: entry.until });
  }

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
