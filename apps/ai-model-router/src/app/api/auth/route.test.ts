import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("@/lib/db", () => ({
  getSetting: (key: string, fallback = "") => store.get(key) ?? fallback,
  setSetting: (key: string, value: string) => {
    store.set(key, value);
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { POST } from "./route";
const limiter = await import("@/lib/login-rate-limit");
const { setPassword } = await import("@/lib/auth");

const MAX = limiter.LOGIN_RATE_LIMIT_MAX_FAILURES;

function post(body: unknown, ip = "203.0.113.7") {
  return POST(
    new Request("http://localhost/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

async function lockClient(ip: string) {
  // Each failure triggers the persisted global backoff in auth.ts, so step
  // past it between attempts; the per-client counter is unaffected until N.
  for (let i = 0; i < MAX; i++) {
    const res = await post({ password: "wrong-password" }, ip);
    expect(res.status).toBe(401);
    if (i < MAX - 1) vi.advanceTimersByTime(60_000);
  }
}

let originalProxyHops: string | undefined;
beforeEach(() => {
  store.clear();
  vi.useRealTimers();
  limiter.resetClientRateLimits();
  originalProxyHops = process.env.AMR_TRUSTED_PROXY_HOPS;
});
afterEach(() => {
  vi.useRealTimers();
  if (originalProxyHops === undefined) delete process.env.AMR_TRUSTED_PROXY_HOPS;
  else process.env.AMR_TRUSTED_PROXY_HOPS = originalProxyHops;
});

describe("POST /api/auth (login) rate limiting", () => {
  it("answers a successful login with a session cookie", async () => {
    await setPassword("the-right-password");

    const res = await post({ password: "the-right-password" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(res.cookies.get("amr_session")?.value).toBeTruthy();
  });

  it("locks the client out after N consecutive failures", async () => {
    await setPassword("the-right-password");
    vi.useFakeTimers();
    await lockClient("203.0.113.7");

    // The client check runs before the password check, so the Nth failure
    // leaves a full remaining cooldown for the next attempt.
    const res = await post({ password: "the-right-password" });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("900");
    expect(Object.keys(body).sort()).toEqual(["error"]);
  });

  it("does not leak account facts in the locked response", async () => {
    process.env.AMR_TRUSTED_PROXY_HOPS = "1";
    try {
      await setPassword("the-right-password");
      vi.useFakeTimers();
      await lockClient("203.0.113.7");

      const locked = await post({ password: "the-right-password" });
      // Step past the global account backoff so the baseline below is a plain
      // 401 from the password check, not a 429 from the other lockout layer.
      vi.advanceTimersByTime(60_000);
      const wrongPassword = await post({ password: "another-wrong" }, "198.51.100.5");

      const lockedBody = await locked.json();
      const wrongBody = await wrongPassword.json();
      expect(locked.status).toBe(429);
      expect(wrongPassword.status).toBe(401);
      expect(Object.keys(lockedBody).sort()).toEqual(Object.keys(wrongBody).sort());
      expect(typeof wrongBody.error).toBe("string");
    } finally {
      // restored by afterEach
    }
  });

  it("rejects a correct password during the lockout window", async () => {
    await setPassword("the-right-password");
    vi.useFakeTimers();
    await lockClient("203.0.113.7");

    const res = await post({ password: "the-right-password" });

    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("allows a fresh attempt after the cooldown expires", async () => {
    await setPassword("the-right-password");
    vi.useFakeTimers();
    await lockClient("203.0.113.7");

    const locked = await post({ password: "the-right-password" });
    expect(locked.status).toBe(429);

    vi.advanceTimersByTime(limiter.LOGIN_RATE_LIMIT_COOLDOWN_MS + 1000);

    const fresh = await post({ password: "the-right-password" });
    expect(fresh.status).toBe(200);
    expect(fresh.cookies.get("amr_session")?.value).toBeTruthy();

    // The counter restarted: one failure is no longer a lockout.
    const next = await post({ password: "wrong-password" });
    expect(next.status).toBe(401);
  });

  it("keys clients independently", async () => {
    process.env.AMR_TRUSTED_PROXY_HOPS = "1";
    try {
      await setPassword("the-right-password");
      vi.useFakeTimers();
      await lockClient("203.0.113.7");
      vi.advanceTimersByTime(60_000);

      const other = await post({ password: "the-right-password" }, "198.51.100.22");

      expect(other.status).toBe(200);
    } finally {
      // restored by afterEach
    }
  });
  it("spoofed X-Forwarded-For does not escape the lockout", async () => {
    delete process.env.AMR_TRUSTED_PROXY_HOPS;
    await setPassword("the-right-password");
    vi.useFakeTimers();
    await lockClient("203.0.113.7");
    vi.advanceTimersByTime(60_000);

    const res = await post({ password: "the-right-password" }, "9.9.9.9");
    expect(res.status).toBe(429);
  });
});
