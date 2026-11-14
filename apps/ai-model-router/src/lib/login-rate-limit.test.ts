import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  LOGIN_RATE_LIMIT_COOLDOWN_MS,
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  clearClientFailures,
  clientLockoutRemainingMs,
  recordClientFailure,
  resetClientRateLimits,
} = await import("./login-rate-limit");

beforeEach(() => {
  resetClientRateLimits();
  vi.useRealTimers();
});

describe("recordClientFailure", () => {
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
    vi.useRealTimers();

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
