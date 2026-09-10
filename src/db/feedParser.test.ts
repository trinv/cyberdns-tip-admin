import { describe, expect, it } from 'vitest';
import { normalizeDomain, parseFeedText } from './feedParser.ts';

describe('normalizeDomain', () => {
  it('lowercases and trims', () => {
    expect(normalizeDomain('  Evil.COM ')).toBe('evil.com');
  });

  it('strips a leading wildcard label', () => {
    expect(normalizeDomain('*.ads.evil.com')).toBe('ads.evil.com');
  });

  it('strips a trailing FQDN root dot so evil.com and evil.com. collapse', () => {
    expect(normalizeDomain('evil.com.')).toBe('evil.com');
    expect(normalizeDomain('evil.com.')).toBe(normalizeDomain('evil.com'));
  });

  it('strips scheme, port, path and query', () => {
    expect(normalizeDomain('http://evil.com/a/b?c=1')).toBe('evil.com');
    expect(normalizeDomain('https://evil.com:8443/x')).toBe('evil.com');
  });

  it('rejects bare IPv4 and junk', () => {
    expect(normalizeDomain('1.2.3.4')).toBeNull();
    expect(normalizeDomain('http://10.0.0.1/x')).toBeNull();
    expect(normalizeDomain('not a domain')).toBeNull();
    expect(normalizeDomain('-leadinghyphen.com')).toBeNull();
    expect(normalizeDomain('a..b.com')).toBeNull();
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain('localhost')).toBeNull();
  });

  it('keeps a normal multi-label hostname intact', () => {
    expect(normalizeDomain('a.b.c.example.co.uk')).toBe('a.b.c.example.co.uk');
  });
});

describe('parseFeedText', () => {
  it('parses hosts-file lines and drops the sink IP', () => {
    const { domains } = parseFeedText('0.0.0.0 ads.example.com\n127.0.0.1 track.example.net');
    expect(domains.sort()).toEqual(['ads.example.com', 'track.example.net']);
  });

  it('parses AdBlock "||domain^" rules including ones with $options', () => {
    const { domains } = parseFeedText('||doubleclick.net^\n||scorecardresearch.com^$third-party');
    expect(domains.sort()).toEqual(['doubleclick.net', 'scorecardresearch.com']);
  });

  it('ignores comments, headers, exception rules and cosmetic filters', () => {
    const { domains } = parseFeedText(
      ['# comment', '! adblock comment', '[Adblock Plus 2.0]', '@@||allowed.example^', 'example.com##.ad', ';win-hosts comment'].join('\n')
    );
    expect(domains).toEqual([]);
  });

  it('deduplicates across formats and normalizes', () => {
    const { domains } = parseFeedText(['evil.com', '0.0.0.0 evil.com', '||evil.com^', '*.evil.com', 'EVIL.com.'].join('\n'));
    expect(domains).toEqual(['evil.com']);
  });

  it('rejects bare IPv4 noise that is character-class compatible with a domain', () => {
    const { domains } = parseFeedText('0.0.0.0 0.0.0.0\n127.0.0.1 127.0.0.1');
    expect(domains).toEqual([]);
  });
});
