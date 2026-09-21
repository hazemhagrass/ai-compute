import { describe, expect, it } from "vitest";

import { assertSafeProviderUrl, isPrivateHost } from "./url-guard";

/** Private hosts are allowed by default in dev, so pin the flag in each test. */
const STRICT = { allowPrivate: false } as const;
const LOOSE = { allowPrivate: true } as const;

describe("assertSafeProviderUrl: schemes", () => {
  it.each(["file:///etc/passwd", "gopher://127.0.0.1:70/_x", "data:text/plain,hi"])(
    "rejects %s",
    (raw) => {
      expect(() => assertSafeProviderUrl(raw, LOOSE)).toThrow(/http or https/i);
    },
  );

  it("rejects a non-absolute URL with an actionable message", () => {
    expect(() => assertSafeProviderUrl("api.example.com/v1", LOOSE)).toThrow(
      /not a valid absolute URL/i,
    );
  });

  it("rejects an empty or whitespace-only URL", () => {
    expect(() => assertSafeProviderUrl("", LOOSE)).toThrow(/required/i);
    expect(() => assertSafeProviderUrl("   ", LOOSE)).toThrow(/required/i);
  });
});

describe("assertSafeProviderUrl: embedded credentials", () => {
  it("rejects user:pass@host", () => {
    expect(() => assertSafeProviderUrl("https://user:pass@api.example.com/v1", LOOSE)).toThrow(
      /must not embed credentials/i,
    );
  });

  it("rejects a username with no password", () => {
    expect(() => assertSafeProviderUrl("https://token@api.example.com/v1", LOOSE)).toThrow(
      /must not embed credentials/i,
    );
  });
});

describe("assertSafeProviderUrl: private ranges", () => {
  const privateUrls = [
    ["loopback", "http://127.0.0.1:11434/v1"],
    ["loopback, whole /8", "http://127.9.9.9/v1"],
    ["localhost name", "http://localhost:11434/v1"],
    ["10/8", "http://10.0.0.5/v1"],
    ["172.16/12 low edge", "http://172.16.0.1/v1"],
    ["172.16/12 high edge", "http://172.31.255.254/v1"],
    ["192.168/16", "http://192.168.1.10/v1"],
    ["CGNAT 100.64/10 low edge", "http://100.64.0.1/v1"],
    ["CGNAT 100.64/10 high edge", "http://100.127.255.254/v1"],
    ["unspecified 0.0.0.0", "http://0.0.0.0/v1"],
    ["IPv6 loopback", "http://[::1]:11434/v1"],
    ["IPv6 unique-local fc00::/7", "http://[fd00::1]/v1"],
    ["IPv6 unique-local fc range", "http://[fc00::abcd]/v1"],
    ["mDNS .local", "http://printer.local/v1"],
    ["corp .internal", "http://vault.internal/v1"],
  ] as const;

  it.each(privateUrls)("rejects %s when allowPrivate is false", (_label, raw) => {
    expect(() => assertSafeProviderUrl(raw, STRICT)).toThrow(/private or loopback/i);
  });

  it.each(privateUrls)("accepts %s when allowPrivate is true", (_label, raw) => {
    expect(() => assertSafeProviderUrl(raw, LOOSE)).not.toThrow();
  });

  it("does not mistake a public neighbour of a private range for private", () => {
    // 172.32/12 and 100.128/9 sit just outside the blocked blocks. Getting the
    // boundary wrong the other way would silently break real providers.
    expect(isPrivateHost("172.32.0.1")).toBe(false);
    expect(isPrivateHost("172.15.255.255")).toBe(false);
    expect(isPrivateHost("100.63.255.255")).toBe(false);
    expect(isPrivateHost("100.128.0.1")).toBe(false);
  });
});

describe("assertSafeProviderUrl: IPv4-mapped IPv6 bypass", () => {
  // The WHATWG parser rewrites ::ffff:127.0.0.1 to ::ffff:7f00:1, so any guard
  // that greps the hostname for "127." is bypassed by this form.
  it("rejects ::ffff:127.0.0.1 under strict policy", () => {
    expect(() => assertSafeProviderUrl("http://[::ffff:127.0.0.1]/v1", STRICT)).toThrow(
      /private or loopback/i,
    );
  });

  it("rejects the hex-rendered mapped loopback ::ffff:7f00:1", () => {
    expect(isPrivateHost("::ffff:7f00:1")).toBe(true);
    expect(isPrivateHost("[::ffff:7f00:1]")).toBe(true);
  });

  it("rejects mapped RFC1918 and CGNAT addresses", () => {
    expect(isPrivateHost("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateHost("::ffff:192.168.0.1")).toBe(true);
    expect(isPrivateHost("::ffff:172.20.0.1")).toBe(true);
    expect(isPrivateHost("::ffff:100.64.0.1")).toBe(true);
  });

  it("rejects the deprecated IPv4-compatible form ::127.0.0.1", () => {
    expect(isPrivateHost("::127.0.0.1")).toBe(true);
  });

  it("still allows a mapped public address", () => {
    expect(isPrivateHost("::ffff:93.184.216.34")).toBe(false);
  });

  it("rejects decimal and hex encodings of loopback, which the URL parser normalizes", () => {
    // http://2130706433/ and http://0x7f.1/ both parse to 127.0.0.1.
    expect(assertSafeProviderUrl("http://2130706433/v1", LOOSE).hostname).toBe("127.0.0.1");
    expect(() => assertSafeProviderUrl("http://2130706433/v1", STRICT)).toThrow(
      /private or loopback/i,
    );
    expect(() => assertSafeProviderUrl("http://0x7f.0.0.1/v1", STRICT)).toThrow(
      /private or loopback/i,
    );
  });
});

describe("assertSafeProviderUrl: link-local metadata is never allowed", () => {
  it("rejects 169.254.169.254 even when allowPrivate is true", () => {
    expect(() => assertSafeProviderUrl("http://169.254.169.254/latest/meta-data/", LOOSE)).toThrow(
      /link-local or cloud metadata/i,
    );
  });

  it("rejects the whole 169.254/16 range even when allowPrivate is true", () => {
    expect(() => assertSafeProviderUrl("http://169.254.0.1/v1", LOOSE)).toThrow(
      /link-local or cloud metadata/i,
    );
  });

  it("rejects the IPv4-mapped metadata address even when allowPrivate is true", () => {
    expect(() => assertSafeProviderUrl("http://[::ffff:169.254.169.254]/v1", LOOSE)).toThrow(
      /link-local or cloud metadata/i,
    );
  });

  it("rejects IPv6 link-local fe80::/10 even when allowPrivate is true", () => {
    expect(() => assertSafeProviderUrl("http://[fe80::1]/v1", LOOSE)).toThrow(
      /link-local or cloud metadata/i,
    );
  });

  it("rejects metadata.google.internal even when allowPrivate is true", () => {
    expect(() =>
      assertSafeProviderUrl("http://metadata.google.internal/computeMetadata/v1/", LOOSE),
    ).toThrow(/link-local or cloud metadata/i);
  });
});

describe("assertSafeProviderUrl: public URLs are accepted", () => {
  it("preserves path and port", () => {
    const url = assertSafeProviderUrl("https://api.example.com:8443/v1/openai", STRICT);

    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("api.example.com");
    expect(url.port).toBe("8443");
    expect(url.pathname).toBe("/v1/openai");
  });

  it("accepts the real provider endpoints this app ships with", () => {
    for (const raw of [
      "https://api.openai.com/v1",
      "https://api.anthropic.com/v1",
      "https://generativelanguage.googleapis.com/v1beta",
      "https://api.groq.com/openai/v1",
    ]) {
      expect(() => assertSafeProviderUrl(raw, STRICT)).not.toThrow();
    }
  });

  it("accepts a public IPv4 and a public IPv6 literal", () => {
    expect(assertSafeProviderUrl("https://93.184.216.34/v1", STRICT).hostname).toBe(
      "93.184.216.34",
    );
    expect(() => assertSafeProviderUrl("https://[2606:4700::1111]/v1", STRICT)).not.toThrow();
  });

  it("trims surrounding whitespace and keeps the query string", () => {
    const url = assertSafeProviderUrl("  https://api.example.com/v1?region=eu  ", STRICT);

    expect(url.href).toBe("https://api.example.com/v1?region=eu");
  });

  it("does not treat a hostname merely containing a private literal as private", () => {
    expect(isPrivateHost("127-0-0-1.nip.example.com")).toBe(false);
    expect(isPrivateHost("api.localhost.example.com")).toBe(false);
  });
});

describe("isPrivateHost", () => {
  it("treats an empty hostname as private, failing closed", () => {
    expect(isPrivateHost("")).toBe(true);
  });

  it("ignores a fully qualified trailing dot", () => {
    expect(isPrivateHost("localhost.")).toBe(true);
    expect(isPrivateHost("api.example.com.")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isPrivateHost("LocalHost")).toBe(true);
    expect(isPrivateHost("[::FFFF:127.0.0.1]")).toBe(true);
  });
});
