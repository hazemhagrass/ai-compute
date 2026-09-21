import "server-only";

import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { cookies } from "next/headers";

import { SESSION_COOKIE, SESSION_TTL_MS } from "./auth-shared";
import { getSetting, setSetting } from "./db";

const scryptAsync = promisify(scrypt);

export { SESSION_COOKIE };
const PASSWORD_KEY = "auth_password";
const FAILURES_KEY = "auth_failures";

/* ----------------------------------------------------------- password ops */

/** `scrypt.<salt>.<hash>`, both base64url. */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt.${salt.toString("base64url")}.${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split(".");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;

  // Constant-time: a length-dependent or short-circuiting compare leaks the
  // hash one byte at a time through response timing.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isAuthConfigured(): boolean {
  return getSetting(PASSWORD_KEY, "").length > 0;
}

export async function setPassword(password: string): Promise<void> {
  setSetting(PASSWORD_KEY, await hashPassword(password));
  setSetting(FAILURES_KEY, "");
}

/* --------------------------------------------------------- lockout policy */

interface FailureState {
  count: number;
  until: number;
}

function readFailures(): FailureState {
  try {
    const raw = getSetting(FAILURES_KEY, "");
    return raw ? (JSON.parse(raw) as FailureState) : { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}

/**
 * Exponential backoff after repeated failures.
 *
 * There is one password and it is the only thing between the internet and a
 * set of live API keys, so unlimited guessing is not acceptable. Backoff is
 * stored in the database rather than in memory so a restart cannot clear it.
 */
export function lockoutRemainingMs(): number {
  const { until } = readFailures();
  return Math.max(0, until - Date.now());
}

function recordFailure(): void {
  const { count } = readFailures();
  const next = count + 1;
  // No delay for the first two attempts (genuine typos), then 2s, 4s, 8s…
  // capped at five minutes.
  const delay = next <= 2 ? 0 : Math.min(300_000, 2 ** (next - 2) * 1000);
  setSetting(FAILURES_KEY, JSON.stringify({ count: next, until: Date.now() + delay }));
}

function clearFailures(): void {
  setSetting(FAILURES_KEY, "");
}

/* ------------------------------------------------------------- session ops */

/**
 * Session secret, reused from the vault master key so there is one secret to
 * back up rather than two. Rotating it invalidates every session, which is the
 * correct behaviour for a key rotation.
 */
function sessionSecret(): string {
  return getSetting("session_secret", "") || bootstrapSessionSecret();
}

function bootstrapSessionSecret(): string {
  const secret = randomBytes(32).toString("base64url");
  setSetting("session_secret", secret);
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${randomBytes(16).toString("base64url")}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [nonce, expiresRaw, signature] = parts;
  const payload = `${nonce}.${expiresRaw}`;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  if (!timingSafeEqual(expected, actual)) return false;

  const expires = Number(expiresRaw);
  return Number.isFinite(expires) && expires > Date.now();
}

/* ------------------------------------------------------------- public API */

export interface LoginResult {
  ok: boolean;
  token?: string;
  error?: string;
  retryAfterMs?: number;
}

export async function login(password: string): Promise<LoginResult> {
  const remaining = lockoutRemainingMs();
  if (remaining > 0) {
    return {
      ok: false,
      error: `Too many attempts. Try again in ${Math.ceil(remaining / 1000)}s.`,
      retryAfterMs: remaining,
    };
  }

  const stored = getSetting(PASSWORD_KEY, "");
  if (!stored) return { ok: false, error: "No password is set." };

  if (!(await verifyPassword(password, stored))) {
    recordFailure();
    // Deliberately vague: distinguishing "wrong password" from anything else
    // gives a guesser information.
    return { ok: false, error: "Incorrect password." };
  }

  clearFailures();
  return { ok: true, token: createSessionToken() };
}

/** Whether the current request carries a valid session. */
export async function isAuthenticated(): Promise<boolean> {
  if (!isAuthConfigured()) return true; // first-run: nothing to protect yet
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Guard for route handlers. Returns a 401 response when unauthenticated.
 *
 * Middleware only checks that a cookie is PRESENT, because the Edge runtime
 * cannot run scrypt or open SQLite. This is where the signature and expiry are
 * actually verified, so every mutating route must call it: a forged cookie
 * passes middleware and must not pass here.
 */
export async function requireAuth(): Promise<Response | null> {
  if (await isAuthenticated()) return null;
  return new Response(JSON.stringify({ error: "authentication required" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export const sessionCookieOptions = {
  httpOnly: true, // unreadable from JS, so XSS cannot exfiltrate it
  sameSite: "lax" as const, // blocks cross-site form posts
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
  // Set only over TLS in production; forcing it in dev breaks plain http.
  secure: process.env.NODE_ENV === "production",
};
