// Parses raw feed text into a clean, deduplicated domain list. Supports the
// formats real-world DNS blocklists (hagezi, OISD, StevenBlack, etc.) are
// actually published in:
//   - hosts-file:      "0.0.0.0 domain.com" / "127.0.0.1 domain.com"
//   - plain domain list: "domain.com" (optionally "*.domain.com")
//   - AdBlock Plus / uBlock rules: "||domain.com^" (optionally with $options
//     after the ^, e.g. "||domain.com^$third-party") — this is how hagezi's
//     "adblock/*.txt" variants and most ad/tracker lists ship.
// Deliberately excludes AdBlock rule types that are NOT plain domain blocks
// — exceptions ("@@||domain^"), cosmetic filters ("##", "#@#"), and any rule
// with extra path/selector syntax — rather than mis-parsing them into a
// domain that was never actually meant to be blocked wholesale.
//
// Mirrors (a superset of) the client-side parser in ImportView.tsx, kept as
// a separate server-side copy since this runs in Node without a DOM.

const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
// A bare IPv4 address (e.g. hosts-file noise like "0.0.0.0 0.0.0.0") is
// character-class-compatible with DOMAIN_REGEX (digits are valid label
// chars) but is never a real domain — reject it explicitly.
const IPV4_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
// "||domain.com^" or "||domain.com^$option,other-option" — captures just the
// domain. The character class deliberately excludes "/" and "*" so a
// path-based or wildcard-path AdBlock rule (not a plain domain block) fails
// to match here and falls through to (and gets rejected by) the generic path below.
const ADBLOCK_DOMAIN_RULE = /^\|\|([a-z0-9.-]+)\^/i;

/**
 * Canonicalize one already-extracted host token, or return `null` if it isn't
 * a plain blockable domain. This is the ONE place domain normalization lives —
 * shared by this feed parser's generic path and by the manual / batch-import
 * propose path (bulkCreateReviewItems in queries.ts), so "*.evil.com",
 * "evil.com.", "http://evil.com/path" and "EVIL.com" all collapse to the same
 * key "evil.com" no matter which door a domain comes in through. Previously the
 * manual path only did `toLowerCase().trim()`, letting those variants through
 * as distinct string keys (LOGIC-11).
 */
export function normalizeDomain(raw: string): string | null {
  let host = (raw ?? '').trim();
  if (!host) return null;
  host = host.replace(/^(https?:\/\/)/i, '');   // scheme
  host = host.split('/')[0].split('?')[0];      // path / query
  host = host.split(':')[0];                    // port
  host = host.replace(/^\*\./, '');             // leading wildcard label
  host = host.replace(/\.$/, '');               // trailing FQDN root dot
  host = host.toLowerCase().trim();
  if (!DOMAIN_REGEX.test(host) || IPV4_REGEX.test(host)) return null;
  return host;
}

function parseFeedLine(line: string): string | null {
  let cleaned = line.trim();
  if (!cleaned) return null;
  // Comment lines (#, !, ;) and an AdBlock list's "[Adblock Plus]" header.
  if (cleaned.startsWith('#') || cleaned.startsWith('!') || cleaned.startsWith(';') || cleaned.startsWith('[')) {
    return null;
  }
  // "@@||domain^" is an EXCEPTION (unblock) rule — including it as a block
  // target would do the opposite of what the list author intended.
  if (cleaned.startsWith('@@')) return null;
  // Cosmetic filters (element hiding, not domain blocking) — not relevant here.
  if (cleaned.includes('##') || cleaned.includes('#@#')) return null;

  const adblockMatch = cleaned.match(ADBLOCK_DOMAIN_RULE);
  if (adblockMatch) {
    return normalizeDomain(adblockMatch[1]);
  }

  // hosts-file style prefix strip: "0.0.0.0 domain.com" / "127.0.0.1 domain.com"
  cleaned = cleaned.replace(/^(0\.0\.0\.0|127\.0\.0\.1|::1?)\s+/, '');
  // Strip trailing inline comments.
  cleaned = cleaned.split('#')[0].trim();
  if (!cleaned) return null;
  // Scheme / path / port / wildcard / trailing-dot stripping + validation all
  // live in normalizeDomain now, shared with the manual propose path.
  return normalizeDomain(cleaned);
}

// No cap on the number of domains parsed from one feed — a sync is expected
// to load however many valid entries the feed actually contains.
export function parseFeedText(text: string): { domains: string[] } {
  const seen = new Set<string>();

  for (const line of text.split('\n')) {
    const domain = parseFeedLine(line);
    if (domain) seen.add(domain);
  }

  return { domains: Array.from(seen) };
}
