import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { securityHeaders } from './securityHeaders.ts';

function fakeRes() {
  const headers: Record<string, string> = {};
  const res = {
    headers,
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
  };
  return res as unknown as Response & { headers: Record<string, string> };
}

const call = (reqPartial: Partial<Request>) => {
  const res = fakeRes();
  let nexted = false;
  securityHeaders()(reqPartial as Request, res, () => {
    nexted = true;
  });
  return { headers: res.headers, nexted };
};

afterEach(() => vi.unstubAllEnvs());

describe('securityHeaders', () => {
  it('always sets the baseline hardening headers and calls next()', () => {
    const { headers, nexted } = call({ headers: {} });
    expect(nexted).toBe(true);
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['permissions-policy']).toContain('geolocation=()');
  });

  it('sends HSTS only when the request is HTTPS (directly or via the proxy header)', () => {
    expect(call({ headers: {} }).headers['strict-transport-security']).toBeUndefined();
    expect(
      call({ headers: { 'x-forwarded-proto': 'https' } }).headers['strict-transport-security'],
    ).toContain('max-age=31536000');
    expect(call({ secure: true, headers: {} }).headers['strict-transport-security']).toContain(
      'includeSubDomains',
    );
  });

  it('sends CSP only in production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(call({ headers: {} }).headers['content-security-policy']).toBeUndefined();

    vi.stubEnv('NODE_ENV', 'production');
    const csp = call({ headers: {} }).headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('https://*.basemaps.cartocdn.com');
    expect(csp).toContain('https://fonts.gstatic.com');
    // never loosen script-src
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
