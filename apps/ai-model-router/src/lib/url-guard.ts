const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isLinkLocalV4(octets: number[]): boolean {
  return octets[0] === 169 && octets[1] === 254;
}

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

function parseIPv6(hostname: string): number[] | null {
  let text = hostname.toLowerCase();
  if (text.includes("%")) text = text.slice(0, text.indexOf("%"));
  if (!/^[0-9a-f:.]+$/.test(text)) return null;

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

function mappedIPv4(groups: number[]): number[] | null {
  const prefixIsZero = groups.slice(0, 5).every((g) => g === 0);
  if (!prefixIsZero) return null;
  if (groups[5] !== 0xffff && groups[5] !== 0) return null;
  const [g6, g7] = [groups[6], groups[7]];
  if (groups[5] === 0 && g6 === 0 && g7 <= 1) return null;
  return [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff];
}

function isPrivateIPv4(o: number[]): boolean {
  if (o[0] === 0) return true;
  if (o[0] === 10) return true;
  if (o[0] === 127) return true;
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
  if (o[0] === 192 && o[1] === 168) return true;
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true;
  if (o[0] === 192 && o[1] === 0 && o[2] === 0) return true;
  if (o[0] >= 224) return true;
  return isLinkLocalV4(o);
}

export function isPrivateHost(hostname: string): boolean {
  if (!hostname) return true;
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host.endsWith(".")) host = host.slice(0, -1);

  const v4 = parseIPv4(host);
  if (v4) return isPrivateIPv4(v4);

  const v6 = parseIPv6(host);
  if (v6) {
    const embedded = mappedIPv4(v6);
    if (embedded) return isPrivateIPv4(embedded);
    if (v6.every((g) => g === 0)) return true;
    if (v6.slice(0, 7).every((g) => g === 0) && v6[7] === 1) return true;
    if ((v6[0] & 0xfe00) === 0xfc00) return true;
    if ((v6[0] & 0xffc0) === 0xfe80) return true;
    return false;
  }

  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.endsWith(".home.arpa") || host === "metadata.google.internal") return true;
  return false;
}

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

export function defaultAllowPrivate(): boolean {
  return process.env.NODE_ENV !== "production";
}

export interface SafeUrlOptions {
  allowPrivate?: boolean;
}

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
