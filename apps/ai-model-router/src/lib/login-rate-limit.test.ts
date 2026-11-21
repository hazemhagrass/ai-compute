import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  LOGIN_RATE_LIMIT_COOLDOWN_MS,
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  clearClientFailures,
  clientKeyFromRequest,
  clientLockoutRemainingMs,
  recordClientFailure,
  resetClientRateLimits,
} = await import("./login-rate-limit");

beforeEach(() => {
  resetClientRateLimits();
  vi.useRealTimers();
});

describe("recordClientFailure", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it("does not lock before N consecutive failures", () => {
    for (let i = 1; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++) {
      recordClientFailure("1.2.3.4");
      expect(clientLockoutRemainingMs("1.2.3.4")).toBe(0);
    }
  });

  it("locks for the cooldown window at the Nth consecutive failure", () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++) recordClientFailure("1.2.3.4");

    const remaining = clientLockoutRemainingMs("1.2.3.4");

    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(LOGIN_RATE_LIMIT_COOLDOWN_MS);
  });

  it("starts fresh after the cooldown expires", () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++) recordClientFailure("1.2.3.4");
    expect(clientLockoutRemainingMs("1.2.3.4")).toBeGreaterThan(0);

    vi.useFakeTimers();
    vi.advanceTimersByTime(LOGIN_RATE_LIMIT_COOLDOWN_MS + 1000);
    expect(clientLockoutRemainingMs("1.2.3.4")).toBe(0);

    recordClientFailure("1.2.3.4");
    expect(clientLockoutRemainingMs("1.2.3.4")).toBe(0);

    for (let i = 1; i < LOGIN_RATE_LIMIT_MAX_FAILURES - 1; i++) recordClientFailure("1.2.3.4");
    expect(clientLockoutRemainingMs("1.2.3.4")).toBe(0);
  });

  it("clears the counter after a successful login", () => {
    for (let i = 1; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++) recordClientFailure("1.2.3.4");
    clearClientFailures("1.2.3.4");

    for (let i = 1; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++) recordClientFailure("1.2.3.4");
    expect(clientLockoutRemainingMs("1.2.3.4")).toBe(0);
  });

  it("keys clients independently", () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++) recordClientFailure("1.2.3.4");

    expect(clientLockoutRemainingMs("5.6.7.8")).toBe(0);
  });
});

describe("clientKeyFromRequest", () => {
  const envKey = "AMR_TRUSTED_PROXY_HOPS";
  let original: string | undefined;
  beforeEach(() => {
    original = process.env[envKey];
  });
  afterEach(() => {
    if (original === undefined) delete process.env[envKey];
    else process.env[envKey] = original;
  });

  it("(a) env unset + XFF -> direct", () => {
    delete process.env[envKey];
    const req = new Request("http://localhost/api/auth", { headers: { "x-forwarded-for": "1.2.3.4" } });
    expect(clientKeyFromRequest(req)).toBe("direct");
  });

  it("(b) env unset + X-Real-IP -> direct", () => {
    delete process.env[envKey];
    const req = new Request("http://localhost/api/auth", { headers: { "x-real-ip": "1.2.3.4" } });
    expect(clientKeyFromRequest(req)).toBe("direct");
  });

  it("(c) hops=1, XFF spoofed, 10.0.0.9 -> 10.0.0.9", () => {
    process.env[envKey] = "1";
    const req = new Request("http://localhost/api/auth", { headers: { "x-forwarded-for": "spoofed, 10.0.0.9" } });
    expect(clientKeyFromRequest(req)).toBe("10.0.0.9");
  });

  it("(d) hops=2, XFF a, b, c -> b", () => {
    process.env[envKey] = "2";
    const req = new Request("http://localhost/api/auth", { headers: { "x-forwarded-for": "a, b, c" } });
    expect(clientKeyFromRequest(req)).toBe("b");
  });

  it("(e) hops=3, XFF a, b -> direct", () => {
    process.env[envKey] = "3";
    const req = new Request("http://localhost/api/auth", { headers: { "x-forwarded-for": "a, b" } });
    expect(clientKeyFromRequest(req)).toBe("direct");
  });

  it("(f) invalid env -> direct with XFF present", () => {
    for (const v of ["abc", "-1", "1.5"]) {
      process.env[envKey] = v;
      const req = new Request("http://localhost/api/auth", { headers: { "x-forwarded-for": "1.2.3.4" } });
      expect(clientKeyFromRequest(req)).toBe("direct");
    }
  });

  it("(g) hops=1 with no XFF -> direct", () => {
    process.env[envKey] = "1";
    const req = new Request("http://localhost/api/auth");
    expect(clientKeyFromRequest(req)).toBe("direct");
  });
});

describe("stale-count expiry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it("expires stale low counts after cooldown", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 4; i++) recordClientFailure("stale-key");
    vi.advanceTimersByTime(LOGIN_RATE_LIMIT_COOLDOWN_MS + 1);
    recordClientFailure("stale-key");
    expect(clientLockoutRemainingMs("stale-key")).toBe(0);
    for (let i = 0; i < 2; i++) recordClientFailure("stale-key");
    expect(clientLockoutRemainingMs("stale-key")).toBe(0);
  });

  it("5 failures within window lock", () => {
    for (let i = 0; i < 5; i++) recordClientFailure("lock-key");
    expect(clientLockoutRemainingMs("lock-key")).toBeGreaterThan(0);
  });
});
