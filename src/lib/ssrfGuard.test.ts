import { describe, expect, it } from 'vitest';
import { assertPublicFeedUrl, assertResolvesToPublic, SsrfBlockedError } from './ssrfGuard.ts';

describe('assertPublicFeedUrl', () => {
  it('accepts a plain public https URL and returns a URL', () => {
    const u = assertPublicFeedUrl(
      'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt',
    );
    expect(u).toBeInstanceOf(URL);
    expect(u.hostname).toBe('raw.githubusercontent.com');
  });

  it('rejects non-http(s) schemes', () => {
    for (const bad of [
      'ftp://example.com/x',
      'file:///etc/passwd',
      'gopher://example.com',
      'data:text/plain,hi',
    ]) {
      expect(() => assertPublicFeedUrl(bad)).toThrow(SsrfBlockedError);
    }
  });

  it('rejects a malformed URL', () => {
    expect(() => assertPublicFeedUrl('not a url')).toThrow(SsrfBlockedError);
  });

  it('rejects internal/reserved IP literals without any DNS lookup', () => {
    for (const bad of [
      'http://127.0.0.1/x',
      'http://169.254.169.254/latest/meta-data/', // cloud metadata
      'http://10.1.2.3/',
      'http://172.16.5.4/',
      'http://192.168.1.1/',
      'http://100.100.0.1/', // CGNAT 100.64/10
      'http://[::1]/', // bracketed IPv6 loopback
      'http://[fd00::1]/', // IPv6 ULA
      'http://0.0.0.0/',
    ]) {
      expect(() => assertPublicFeedUrl(bad), bad).toThrow(SsrfBlockedError);
    }
  });

  it('allows a public IP literal', () => {
    expect(() => assertPublicFeedUrl('http://1.1.1.1/list.txt')).not.toThrow();
  });
});

describe('assertResolvesToPublic (IP-literal hosts, no real DNS)', () => {
  it('rejects the loopback and metadata addresses (by range, not by DNS failure)', async () => {
    await expect(assertResolvesToPublic(new URL('http://127.0.0.1/'))).rejects.toThrow(/nội bộ|dành riêng/);
    await expect(assertResolvesToPublic(new URL('http://169.254.169.254/'))).rejects.toThrow(
      /nội bộ|dành riêng/,
    );
    await expect(assertResolvesToPublic(new URL('http://[::ffff:127.0.0.1]/'))).rejects.toThrow(
      /nội bộ|dành riêng/,
    );
    await expect(assertResolvesToPublic(new URL('http://[::1]/'))).rejects.toThrow(SsrfBlockedError);
  });

  it('accepts a public IP literal', async () => {
    await expect(assertResolvesToPublic(new URL('http://8.8.8.8/'))).resolves.toBeUndefined();
  });
});
