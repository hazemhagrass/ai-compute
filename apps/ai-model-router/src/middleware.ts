import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-shared";

/**
 * Gate everything behind a session cookie.
 *
 * Middleware runs on the Edge runtime, which has no better-sqlite3 and no
 * node:crypto scrypt, so it cannot verify the signature or read whether a
 * password is configured. It therefore does a cheap presence check only, and
 * the routes themselves re-verify properly. That is deliberate: middleware is
 * the coarse filter, never the security boundary.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The auth endpoint must stay reachable or there is no way to log in.
  if (pathname.startsWith("/api/auth") || pathname === "/login") {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  // An API caller gets a status it can branch on; a browser gets redirected.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
