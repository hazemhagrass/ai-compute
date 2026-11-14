import { describe, expect, it } from "vitest";

import {
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
  applySecurityHeaders,
} from "./security-headers";
import nextConfig from "../../next.config";

const byKey = new Map(SECURITY_HEADERS.map((h) => [h.key, h.value]));

describe("SECURITY_HEADERS", () => {
  it("sets nosniff", () => {
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("frames nothing", () => {
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
    expect(byKey.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("limits the referrer", () => {
    expect(byKey.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("keeps the CSP strict on injection and framing", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
    // No insecure upgrades or loose object sources.
    expect(CONTENT_SECURITY_POLICY).not.toContain("upgrade-insecure-requests");
  });

  it("skips Strict-Transport-Security while the app is served over HTTP", () => {
    expect(SECURITY_HEADERS.some((h) => h.key === "Strict-Transport-Security")).toBe(false);
  });
});

describe("nextConfig", () => {
  it("applies the security header list to every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    expect(rules[0].headers).toEqual(SECURITY_HEADERS.map((h) => ({ ...h })));
  });

  it("does not advertise the server framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("applySecurityHeaders", () => {
  it("adds every security header to a bare response", () => {
    const headers = new Headers();
    applySecurityHeaders({ headers });
    for (const header of SECURITY_HEADERS) {
      expect(headers.get(header.key)).toBe(header.value);
    }
  });

  it("does not clobber a value that is already present", () => {
    const headers = new Headers();
    headers.set("X-Frame-Options", "SAMEORIGIN");
    applySecurityHeaders({ headers });
    expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
