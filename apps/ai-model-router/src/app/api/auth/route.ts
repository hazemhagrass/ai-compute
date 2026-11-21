import { NextResponse } from "next/server";
import { z } from "zod";

import {
  SESSION_COOKIE,
  createSessionToken,
  isAuthConfigured,
  isAuthenticated,
  login,
  sessionCookieOptions,
  setPassword,
} from "@/lib/auth";
import {
  clientKeyFromRequest,
  clientLockoutRemainingMs,
  clearClientFailures,
  recordClientFailure,
} from "@/lib/login-rate-limit";
import { parseBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  password: z.string({ error: "password is required" }).min(1, "password is required"),
});

const setupSchema = z.object({
  password: z
    .string({ error: "password is required" })
    .min(12, "use at least 12 characters"),
});

export async function GET() {
  return NextResponse.json({
    configured: isAuthConfigured(),
    authenticated: await isAuthenticated(),
  });
}

export async function PUT(request: Request) {
  if (isAuthConfigured()) {
    return NextResponse.json(
      { error: "A password is already set. Use the rotate script to change it." },
      { status: 409 },
    );
  }

  const parsed = await parseBody(request, setupSchema);
  if (!parsed.ok) return parsed.response;

  await setPassword(parsed.data.password);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
  return res;
}

export async function POST(request: Request) {
  // Per-client rate limit: reject before parsing or checking the password so a
  // locked client cannot keep probing the account lockout either.
  const clientKey = clientKeyFromRequest(request);
  const clientLockoutMs = clientLockoutRemainingMs(clientKey);
  if (clientLockoutMs > 0) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "retry-after": String(Math.ceil(clientLockoutMs / 1000)) } },
    );
  }

  const parsed = await parseBody(request, loginSchema);
  if (!parsed.ok) return parsed.response;

  const result = await login(parsed.data.password);
  if (!result.ok) {
    // Count only failures where this client actually reached the password
    // check; the account-level global lockout already answers 429 itself.
    if (!result.retryAfterMs) recordClientFailure(clientKey);
    return NextResponse.json(
      { error: result.error },
      {
        status: result.retryAfterMs ? 429 : 401,
        ...(result.retryAfterMs
          ? { headers: { "retry-after": String(Math.ceil(result.retryAfterMs / 1000)) } }
          : {}),
      },
    );
  }

  clearClientFailures(clientKey);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, result.token!, sessionCookieOptions);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
