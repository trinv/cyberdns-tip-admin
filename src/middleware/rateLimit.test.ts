import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createLoginRateLimiter } from './rateLimit.ts';

// Minimal stand-ins — the limiter only ever touches req.ip / req.body.email
// and res.set / res.status / res.json.
const req = (ip: string, email?: string) => ({ ip, body: email ? { email } : {} }) as unknown as Request;

function fakeRes() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    set(k: string, v: string) {
      this.headers[k] = v;
      return this;
    },
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  };
  return res;
}

const run = (limiter: ReturnType<typeof createLoginRateLimiter>, r: Request) => {
  const res = fakeRes();
  let nexted = false;
  limiter.middleware(r, res as unknown as Response, () => {
    nexted = true;
  });
  return { res, nexted };
};

describe('createLoginRateLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lets attempts through while under the limit', () => {
    const limiter = createLoginRateLimiter({ maxAttempts: 3 });
    for (let i = 0; i < 2; i++) limiter.recordFailure(req('1.1.1.1', 'a@x.com'));
    expect(run(limiter, req('1.1.1.1', 'a@x.com')).nexted).toBe(true);
  });

  it('locks the client IP once maxAttempts failures are reached', () => {
    const limiter = createLoginRateLimiter({ maxAttempts: 3, lockMs: 60_000 });
    for (let i = 0; i < 3; i++) limiter.recordFailure(req('9.9.9.9', 'victim@x.com'));

    const { res, nexted } = run(limiter, req('9.9.9.9', 'other@x.com'));
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('locks the target email independently of the source IP (password spray)', () => {
    const limiter = createLoginRateLimiter({ maxAttempts: 3, lockMs: 60_000 });
    for (let i = 0; i < 3; i++) limiter.recordFailure(req(`10.0.0.${i}`, 'victim@x.com'));

    // A brand-new IP, but the same targeted account → still blocked.
    expect(run(limiter, req('203.0.113.7', 'victim@x.com')).res.statusCode).toBe(429);
    // A different account from that new IP → allowed.
    expect(run(limiter, req('203.0.113.7', 'someone-else@x.com')).nexted).toBe(true);
  });

  it('recordSuccess clears the counters for that IP and email', () => {
    const limiter = createLoginRateLimiter({ maxAttempts: 3, lockMs: 60_000 });
    for (let i = 0; i < 3; i++) limiter.recordFailure(req('9.9.9.9', 'victim@x.com'));
    expect(run(limiter, req('9.9.9.9', 'victim@x.com')).res.statusCode).toBe(429);

    limiter.recordSuccess(req('9.9.9.9', 'victim@x.com'));
    expect(run(limiter, req('9.9.9.9', 'victim@x.com')).nexted).toBe(true);
  });

  it('releases the lock after lockMs elapses', () => {
    const limiter = createLoginRateLimiter({ maxAttempts: 3, lockMs: 60_000 });
    for (let i = 0; i < 3; i++) limiter.recordFailure(req('9.9.9.9'));
    expect(run(limiter, req('9.9.9.9')).res.statusCode).toBe(429);

    vi.advanceTimersByTime(60_001);
    expect(run(limiter, req('9.9.9.9')).nexted).toBe(true);
  });
});
