import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The auth module reads and writes settings through db.ts, which opens a real
 * SQLite file. Mocking that one seam keeps these tests about the crypto and the
 * policy rather than about disk state.
 */
const store = new Map<string, string>();

vi.mock("./db", () => ({
  getSetting: (key: string, fallback = "") => store.get(key) ?? fallback,
  setSetting: (key: string, value: string) => {
    store.set(key, value);
  },
}));

// cookies() is only used by isAuthenticated, which the route layer exercises.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const {
  createSessionToken,
  isAuthConfigured,
  lockoutRemainingMs,
  login,
  setPassword,
  verifySessionToken,
} = await import("./auth");

beforeEach(() => {
  store.clear();
  vi.useRealTimers();
});

describe("password storage", () => {
  it("never stores the plaintext", async () => {
    await setPassword("correct horse battery staple");
    const stored = store.get("auth_password")!;

    expect(stored).not.toContain("correct horse");
    expect(stored.startsWith("scrypt.")).toBe(true);
    expect(stored.split(".")).toHaveLength(3);
  });

  it("salts, so the same password hashes differently twice", async () => {
    await setPassword("same-password-twice");
    const first = store.get("auth_password")!;

    await setPassword("same-password-twice");
    const second = store.get("auth_password")!;

    // Without a per-password salt these would be identical, and a single
    // rainbow table would cover every install of this app.
    expect(first).not.toBe(second);
  });

  it("reports whether auth is configured", async () => {
    expect(isAuthConfigured()).toBe(false);
    await setPassword("a-real-password-here");
    expect(isAuthConfigured()).toBe(true);
  });
});

describe("login", () => {
  it("accepts the right password and issues a token", async () => {
    await setPassword("the-right-password");

    const result = await login("the-right-password");

    expect(result.ok).toBe(true);
    expect(verifySessionToken(result.token)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    await setPassword("the-right-password");

    const result = await login("the-wrong-password");

    expect(result.ok).toBe(false);
    expect(result.token).toBeUndefined();
  });

  it("does not reveal whether the password merely had a typo", async () => {
    await setPassword("the-right-password");

    const wrong = await login("the-right-passwore");
    const nonsense = await login("zzzzzzzzzzzz");

    // Identical wording both times: a different message for a near-miss would
    // tell a guesser they are close.
    expect(wrong.error).toBe(nonsense.error);
  });

  it("refuses to log in when no password is set", async () => {
    const result = await login("anything");
    expect(result.ok).toBe(false);
  });

  it("clears the failure counter after a success", async () => {
    await setPassword("the-right-password");

    await login("wrong-1");
    await login("wrong-2");
    await login("the-right-password");

    expect(lockoutRemainingMs()).toBe(0);
  });
});

describe("lockout", () => {
  it("allows two typos without penalty, then backs off", async () => {
    await setPassword("the-right-password");

    await login("wrong-1");
    expect(lockoutRemainingMs()).toBe(0);

    await login("wrong-2");
    expect(lockoutRemainingMs()).toBe(0);

    // Third failure starts the backoff.
    await login("wrong-3");
    expect(lockoutRemainingMs()).toBeGreaterThan(0);
  });

  it("grows the delay with each further failure", async () => {
    await setPassword("the-right-password");

    for (let i = 0; i < 3; i++) await login(`wrong-${i}`);
    const afterThree = lockoutRemainingMs();

    // Wait out the lock so the next attempt is actually counted.
    vi.useFakeTimers();
    vi.advanceTimersByTime(afterThree + 1000);
    await login("wrong-again");
    const afterFour = lockoutRemainingMs();
    vi.useRealTimers();

    expect(afterFour).toBeGreaterThan(afterThree);
  });

  it("refuses a correct password while locked out", async () => {
    await setPassword("the-right-password");
    for (let i = 0; i < 4; i++) await login(`wrong-${i}`);

    const result = await login("the-right-password");

    // Otherwise the backoff is trivially bypassed by guessing correctly, which
    // is exactly what an attacker is trying to do.
    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("survives a restart, because the counter lives in the database", async () => {
    await setPassword("the-right-password");
    for (let i = 0; i < 4; i++) await login(`wrong-${i}`);

    const locked = lockoutRemainingMs();
    // The store outlives the module here exactly as the real table outlives a
    // process restart, so an attacker cannot clear the backoff by crashing it.
    expect(locked).toBeGreaterThan(0);
    expect(store.get("auth_failures")).toBeTruthy();
  });
});

describe("session tokens", () => {
  it("rejects a token with a tampered payload", () => {
    const token = createSessionToken();
    const [nonce, expires, signature] = token.split(".");

    // Extend the expiry by a year and keep the original signature.
    const forged = `${nonce}.${Number(expires) + 31_536_000_000}.${signature}`;

    expect(verifySessionToken(forged)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken();

    store.set("session_secret", "a-completely-different-secret");

    // Rotating the secret must invalidate every existing session.
    expect(verifySessionToken(token)).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);

    vi.useFakeTimers();
    vi.advanceTimersByTime(13 * 60 * 60 * 1000); // TTL is 12h
    expect(verifySessionToken(token)).toBe(false);
    vi.useRealTimers();
  });

  it("rejects malformed and empty tokens", () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken("")).toBe(false);
    expect(verifySessionToken("not-a-token")).toBe(false);
    expect(verifySessionToken("only.two")).toBe(false);
    expect(verifySessionToken("a.b.c.d")).toBe(false);
  });
});
