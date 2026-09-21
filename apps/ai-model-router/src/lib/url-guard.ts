/**
 * SSRF guard for user-supplied provider base URLs.
 *
 * A provider row carries a base URL the user typed, and the server then fetches
 * it with the server's own network position and credentials. Unchecked, that is
 * a server-side request forgery primitive: the caller picks any address the
 * server can reach, including cloud metadata and internal admin ports that the
 * public internet cannot touch.
 *
 * WHY STRING MATCHING ON THE HOSTNAME IS NOT A COMPLETE FIX
 * ---------------------------------------------------------
 * Everything below inspects the literal hostname. That stops the direct attacks
 * (http://169.254.169.254, http://[::ffff:127.0.0.1]) but it cannot stop DNS
 * rebinding: an attacker controls evil.example.com, which looks perfectly
 * public here, and answers the lookup with 169.254.169.254 (or flips between a
 * public A record at validation time and a private one milliseconds later, when
 * fetch() performs its own independent resolution). Validation and connection
 * resolve the name separately, so there is a TOCTOU window between them.
 *
 * The complete fix is to close that window: resolve the hostname ourselves
 * (dns.lookup with all:true), run isPrivateHost over every returned address,
 * and then pin the one validated IP for the actual socket, via a custom
 * undici Agent whose connect() dials the checked address while keeping the
 * original Host/SNI. Redirects must be re-validated the same way, or disabled.
 * That needs runtime wiring beyond this module, so this guard is the first
 * layer and deliberately not the only one.
 */

/** Schemes we are willing to fetch. Everything else is rejected outright. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Link-local, which contains the cloud metadata service (169.254.169.254 on
 * AWS, GCP, Azure, DigitalOcean). No provider ever legitimately lives here, so
 * this range is blocked unconditionally and `allowPrivate` cannot re-open it.
 */
function isLinkLocalV4(octets: number[]): boolean {
  return octets[0] === 169 && octets[1] === 254;
}

/** Parse a dotted-quad into octets, or null when the host is not an IPv4 literal. */
function parseIPv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    octets.push(n);
  }
  return octets;
}

/**
 * Expand an IPv6 literal (already stripped of brackets) into 8 numeric groups.
 * Returns null when the input is not a parseable IPv6 address.
 *
 * Handles the `::` run and the trailing dotted-quad form, because
 * `::ffff:127.0.0.1` is the classic guard bypass: it is loopback wearing an
 * IPv6 costume, and the WHATWG URL parser re-renders it as `::ffff:7f00:1`,
 * which defeats any check that greps for "127.0.0.1".
 */
function parseIPv6(hostname: string): number[] | null {
  let text = hostname.toLowerCase();
  if (text.includes("%")) text = text.slice(0, text.indexOf("%")); // drop zone id
  if (!/^[0-9a-f:.]+$/.test(text)) return null;

  // A trailing dotted-quad becomes two hex groups.
  const dotted = text.lastIndexOf(":");
  if (text.includes(".")) {
    const tail = text.slice(dotted + 1);
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    text = `${text.slice(0, dotted + 1)}${hi}:${lo}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const toGroups = (chunk: string): number[] | null => {
    if (!chunk) return [];
    const out: number[] = [];
    for (const g of chunk.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !tail) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;
  const fill = 8 - head.length - tail.length;
  if (fill < 1) return null;
  return [...head, ...new Array<number>(fill).fill(0), ...tail];
}

/** True when the IPv6 groups encode an IPv4-mapped address (::ffff:a.b.c.d). */
function mappedIPv4(groups: number[]): number[] | null {
  const prefixIsZero = groups.slice(0, 5).every((g) => g === 0);
  if (!prefixIsZero) return null;
  // ::ffff:x:x is IPv4-mapped; ::x:x (6th group 0) is the deprecated
  // IPv4-compatible form. Both reach the embedded IPv4 address.
  if (groups[5] !== 0xffff && groups[5] !== 0) return null;
  const [g6, g7] = [groups[6], groups[7]];
  if (groups[5] === 0 && g6 === 0 && g7 <= 1) return null; // :: and ::1, handled as IPv6
  return [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff];
}

function isPrivateIPv4(o: number[]): boolean {
  if (o[0] === 0) return true; // 0.0.0.0/8, "this host"
  if (o[0] === 10) return true; // 10/8
  if (o[0] === 127) return true; // loopback
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // 172.16/12
  if (o[0] === 192 && o[1] === 168) return true; // 192.168/16
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // CGNAT 100.64/10
  if (o[0] === 192 && o[1] === 0 && o[2] === 0) return true; // IETF protocol assignments
  if (o[0] >= 224) return true; // multicast + reserved/broadcast
  return isLinkLocalV4(o);
}

/**
 * Reusable predicate: does this hostname name an address we must not fetch?
 *
 * Accepts bare hostnames, IPv4 literals, and IPv6 literals with or without
 * surrounding brackets. Names that merely look local ("localhost", ".local",
 * ".internal") are covered too, since those are the common shapes in practice.
 */
export function isPrivateHost(hostname: string): boolean {
  if (!hostname) return true;
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host.endsWith(".")) host = host.slice(0, -1); // fully qualified trailing dot

  const v4 = parseIPv4(host);
  if (v4) return isPrivateIPv4(v4);

  const v6 = parseIPv6(host);
  if (v6) {
    const embedded = mappedIPv4(v6);
    if (embedded) return isPrivateIPv4(embedded);
    if (v6.every((g) => g === 0)) return true; // ::
    if (v6.slice(0, 7).every((g) => g === 0) && v6[7] === 1) return true; // ::1 loopback
    if ((v6[0] & 0xfe00) === 0xfc00) return true; // unique-local fc00::/7
    if ((v6[0] & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
    return false;
  }

  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.endsWith(".home.arpa") || host === "metadata.google.internal") return true;
  return false;
}

/** True only for the link-local range, which `allowPrivate` may never unlock. */
export function isAlwaysBlockedHost(hostname: string): boolean {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host === "metadata.google.internal") return true;

  const v4 = parseIPv4(host);
  if (v4) return isLinkLocalV4(v4);

  const v6 = parseIPv6(host);
  if (v6) {
    const embedded = mappedIPv4(v6);
    if (embedded) return isLinkLocalV4(embedded);
    if ((v6[0] & 0xffc0) === 0xfe80) return true;
  }
  return false;
}

/**
 * Private destinations are allowed in development and refused in production.
 *
 * A local Ollama on http://127.0.0.1:11434 is the primary use case of this app
 * while developing, so blocking it by default would break the main flow. A
 * deployed server has no such need, and there the same URL is an attack. The
 * policy is therefore environment-driven rather than a constant.
 */
export function defaultAllowPrivate(): boolean {
  return process.env.NODE_ENV !== "production";
}

export interface SafeUrlOptions {
  /** Defaults to true outside production. Never unlocks the link-local range. */
  allowPrivate?: boolean;
}

/**
 * Validate a user-supplied provider base URL and return the parsed URL.
 * Throws an Error whose message is safe and useful to show to the user.
 */
export function assertSafeProviderUrl(raw: string, opts: SafeUrlOptions = {}): URL {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) throw new Error("Provider URL is required.");

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(
      `Provider URL is not a valid absolute URL: ${text}. Include the scheme, for example https://api.example.com/v1`,
    );
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(
      `Provider URL must use http or https, got "${url.protocol.replace(":", "")}".`,
    );
  }

  // Credentials in the URL leak into logs and error text, and some servers
  // treat the userinfo section as part of the host, which is another way to
  // smuggle a different destination past a naive reader.
  if (url.username || url.password) {
    throw new Error(
      "Provider URL must not embed credentials. Remove the user:password@ part and store the API key separately.",
    );
  }

  const host = url.hostname;
  if (isAlwaysBlockedHost(host)) {
    throw new Error(
      `Provider URL host "${host}" is a link-local or cloud metadata address, which is never allowed.`,
    );
  }

  const allowPrivate = opts.allowPrivate ?? defaultAllowPrivate();
  if (!allowPrivate && isPrivateHost(host)) {
    throw new Error(
      `Provider URL host "${host}" resolves to a private or loopback address, which is not allowed here.`,
    );
  }

  return url;
}
