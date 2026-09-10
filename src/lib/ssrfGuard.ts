import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// SSRF guard for the one place this app fetches an operator-supplied URL:
// threat-intel feed sync (see runFeedSourceSyncJob in queries.ts). Feed
// creation is already Admin-only (server.ts) — this stops even an Admin
// (or a compromised Admin session) from pointing a "feed" at an internal
// service, cloud metadata, or localhost.
//
// Known residual: DNS rebinding (the hostname resolving to a public IP for
// our check, then a private IP for the actual connection) is not fully
// closed here — that needs pinning the connection to the exact IP we
// validated, which Node's global fetch doesn't expose cleanly without
// pulling in undici directly. The pre-resolve check + per-redirect
// re-check below stops the straightforward cases (metadata endpoint,
// localhost, RFC1918 literals, internal hostnames).

const MAX_REDIRECTS = 5;

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}
function inCidr(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(base) & mask);
}

// Every range that must never be reachable from a "feed URL".
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (incl. 169.254.169.254 metadata)
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved
];

function isBlockedV4(ip: string): boolean {
  return BLOCKED_V4.some(([base, bits]) => inCidr(ip, base, bits));
}

// Pull an embedded IPv4 out of the trailing 32 bits of a v4-mapped / -embedded
// IPv6 address, in either textual form:
//   "::ffff:127.0.0.1"   (dotted)   or
//   "::ffff:7f00:1"      (hex — what WHATWG URL / dns.lookup actually emit)
function embeddedV4(addr: string): string | null {
  const dotted = addr.match(/:((?:\d{1,3}\.){3}\d{1,3})$/);
  if (dotted) return dotted[1];
  const hex = addr.match(/:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

function isBlockedV6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]; // drop any zone id
  if (addr === '::1' || addr === '::') return true;
  if (addr.startsWith('fe80:') || addr.startsWith('fe9') || addr.startsWith('fea') || addr.startsWith('feb')) return true; // link-local fe80::/10
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // ULA fc00::/7
  if (addr.startsWith('ff')) return true; // multicast
  if (addr.startsWith('2001:db8:')) return true; // documentation
  // IPv4-mapped ("::ffff:x"), -compatible ("::x", deprecated) and NAT64
  // ("64:ff9b::x") — resolve the embedded v4 (dotted OR hex) and re-check it.
  if (addr.startsWith('::ffff:') || addr.startsWith('64:ff9b:') || addr.startsWith('::')) {
    const v4 = embeddedV4(addr);
    if (v4 && (isBlockedV4(v4) || v4 === '0.0.0.0')) return true;
  }
  return false;
}

function assertIpAllowed(ip: string, host: string) {
  const kind = isIP(ip);
  if (kind === 4 && isBlockedV4(ip)) {
    throw new SsrfBlockedError(`Địa chỉ đích không hợp lệ cho feed URL: ${host} → ${ip} (dải nội bộ/dành riêng).`);
  }
  if (kind === 6 && isBlockedV6(ip)) {
    throw new SsrfBlockedError(`Địa chỉ đích không hợp lệ cho feed URL: ${host} → ${ip} (dải nội bộ/dành riêng).`);
  }
  if (kind === 0) {
    throw new SsrfBlockedError(`Không phân giải được địa chỉ hợp lệ cho ${host}.`);
  }
}

// WHATWG URL keeps an IPv6 literal bracketed in `.hostname` ("[::1]"), which
// neither node:net's isIP nor dns.lookup accept — strip the brackets so an
// IPv6-literal feed URL is range-checked, not waved through / bounced as an
// unresolvable name.
function hostForCheck(url: URL): string {
  const h = url.hostname;
  return h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;
}

// Sync, cheap: scheme + shape. Safe to call at feed-creation time for an
// early, friendly error. NOT the security boundary on its own.
export function assertPublicFeedUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('URL feed không hợp lệ.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfBlockedError(`Chỉ chấp nhận feed qua http/https (nhận được "${url.protocol}").`);
  }
  if (!url.hostname) {
    throw new SsrfBlockedError('URL feed thiếu hostname.');
  }
  // A bare IP literal that's already in a blocked range → reject without
  // even a DNS lookup.
  const host = hostForCheck(url);
  const literalKind = isIP(host);
  if (literalKind !== 0) assertIpAllowed(host, host);
  return url;
}

// Full check: resolve the hostname and verify every returned address is a
// public, routable one. Call this right before fetching.
export async function assertResolvesToPublic(url: URL): Promise<void> {
  const host = hostForCheck(url);
  if (isIP(host) !== 0) {
    assertIpAllowed(host, host);
    return;
  }
  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new SsrfBlockedError(`Không phân giải được hostname của feed: ${host}.`);
  }
  if (addrs.length === 0) {
    throw new SsrfBlockedError(`Không phân giải được hostname của feed: ${host}.`);
  }
  for (const { address } of addrs) assertIpAllowed(address, host);
}

/**
 * fetch() a feed URL with SSRF protection: validates the target (and every
 * redirect hop) resolves to a public address before connecting. Redirects
 * are followed manually so each new Location can be re-checked.
 */
export async function safeFeedFetch(rawUrl: string, init: RequestInit & { signal?: AbortSignal }): Promise<Response> {
  let current = assertPublicFeedUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertResolvesToPublic(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res; // odd, but let the caller deal with it
      if (hop === MAX_REDIRECTS) {
        throw new SsrfBlockedError('Feed URL chuyển hướng quá nhiều lần.');
      }
      current = assertPublicFeedUrl(new URL(location, current).toString());
      continue;
    }
    return res;
  }
  // Unreachable, but satisfies the type checker.
  throw new SsrfBlockedError('Feed URL chuyển hướng quá nhiều lần.');
}
