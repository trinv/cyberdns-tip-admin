import { Request, Response, NextFunction } from 'express';

// A small in-memory brute-force limiter for the login route. In-memory is
// consistent with the rest of this app's single-process design (see the
// feed-sync semaphore in queries.ts) — there is no shared store and the
// deployment runs one instance. It resets on restart, which is acceptable
// for login throttling: a restart is rare and doesn't hand an attacker a
// useful window.
//
// Two independent counters per attempt:
//   - by client IP    → stops credential-stuffing (many accounts, one host)
//   - by target email  → stops password-spray on one account from many IPs
// A request is blocked if EITHER counter is in a locked state.

interface Bucket {
  count: number;
  windowStart: number;
  lockedUntil: number;
}

interface LoginRateLimiterOptions {
  /** Failed attempts allowed within `windowMs` before a lock kicks in. */
  maxAttempts?: number;
  /** Rolling window the attempt count is measured over. */
  windowMs?: number;
  /** How long a key stays locked once `maxAttempts` is exceeded. */
  lockMs?: number;
}

export function createLoginRateLimiter(opts: LoginRateLimiterOptions = {}) {
  const maxAttempts = opts.maxAttempts ?? 8;
  const windowMs = opts.windowMs ?? 15 * 60_000;
  const lockMs = opts.lockMs ?? 15 * 60_000;

  const buckets = new Map<string, Bucket>();

  // Drop keys that are neither locked nor mid-window so the map can't grow
  // without bound under a sustained scan.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (b.lockedUntil <= now && now - b.windowStart >= windowMs) buckets.delete(key);
    }
  }, 60_000);
  sweep.unref?.();

  const emailOf = (req: Request): string | null => {
    const raw = (req.body?.email ?? '').toString().toLowerCase().trim();
    return raw ? raw : null;
  };
  const keysFor = (req: Request): string[] => {
    const keys = [`ip:${req.ip || 'unknown'}`];
    const email = emailOf(req);
    if (email) keys.push(`email:${email}`);
    return keys;
  };

  const lockedRemainingMs = (req: Request): number => {
    const now = Date.now();
    let worst = 0;
    for (const key of keysFor(req)) {
      const b = buckets.get(key);
      if (b && b.lockedUntil > now) worst = Math.max(worst, b.lockedUntil - now);
    }
    return worst;
  };

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const remaining = lockedRemainingMs(req);
    if (remaining > 0) {
      res.set('Retry-After', String(Math.ceil(remaining / 1000)));
      return res.status(429).json({
        error: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ít phút.',
      });
    }
    next();
  };

  /** Call after a login attempt that failed (bad password / unknown / disabled). */
  const recordFailure = (req: Request) => {
    const now = Date.now();
    for (const key of keysFor(req)) {
      let b = buckets.get(key);
      if (!b || now - b.windowStart >= windowMs) {
        b = { count: 0, windowStart: now, lockedUntil: 0 };
        buckets.set(key, b);
      }
      b.count += 1;
      if (b.count >= maxAttempts) {
        b.lockedUntil = now + lockMs;
        // Start a fresh window after the lock so the next burst is measured
        // from zero rather than instantly re-locking.
        b.count = 0;
        b.windowStart = now + lockMs;
      }
    }
  };

  /** Call after a successful login — clears the attacker's progress for a legit user. */
  const recordSuccess = (req: Request) => {
    for (const key of keysFor(req)) buckets.delete(key);
  };

  return { middleware, recordFailure, recordSuccess };
}
