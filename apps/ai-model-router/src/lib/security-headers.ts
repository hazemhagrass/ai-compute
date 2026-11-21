// Security headers applied to every HTTP response from this app.
// next.config.ts applies them to route responses through headers();
// src/middleware.ts stamps them on responses it produces itself
// (the 401 JSON and the /login redirect), which bypass headers().
// Single source of truth: change the header list here only.

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // 'unsafe-inline' for scripts is required by the Next.js App Router:
  // it ships inline RSC flight scripts (self.__next_f.push) on every HTML
  // response. This matches the official no-nonce CSP baseline.
  "script-src 'self' 'unsafe-inline'",
  // Inline style attributes are used for dynamic chart and status colors
  // (style={{ ... }} in components), so styles need 'unsafe-inline'.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  // next/font self-hosts font files under /_next/static, same origin.
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

export const CONTENT_SECURITY_POLICY = CSP_DIRECTIVES.join("; ");

export interface SecurityHeader {
  key: string;
  value: string;
}

// No Strict-Transport-Security: the router is served over plain HTTP
// (LAN, next start). Add it here when the app is served over HTTPS only;
// on HTTP it breaks subresource loading instead of adding security.
export const SECURITY_HEADERS: readonly SecurityHeader[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];

// Minimal structural type so this works on Response, NextResponse,
// and Headers objects without importing next/server here.
interface HeaderSetter {
  headers: {
    has(key: string): boolean;
    set(key: string, value: string): void;
  };
}

export function applySecurityHeaders(response: HeaderSetter): void {
  for (const header of SECURITY_HEADERS) {
    if (!response.headers.has(header.key)) {
      response.headers.set(header.key, header.value);
    }
  }
}
