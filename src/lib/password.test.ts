import { describe, expect, it } from 'vitest';
import {
  burnPasswordCompare,
  generateSessionToken,
  generateTempPassword,
  hashPassword,
  verifyPassword,
} from './password.ts';

describe('hashPassword / verifyPassword', () => {
  it('round-trips the correct password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('s3cret');
    expect(await verifyPassword('S3cret', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('salts: the same password hashes differently each time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('returns false (not throw) for a malformed stored value', async () => {
    expect(await verifyPassword('x', 'no-colon-here')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'deadbeef:zz')).toBe(false);
  });
});

describe('burnPasswordCompare', () => {
  it('resolves without throwing for any input', async () => {
    await expect(burnPasswordCompare('anything')).resolves.toBeUndefined();
    await expect(burnPasswordCompare('')).resolves.toBeUndefined();
  });
});

describe('token generators', () => {
  it('generateSessionToken returns 64 hex chars and is unique', () => {
    const a = generateSessionToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(generateSessionToken());
  });

  it('generateTempPassword returns a non-empty url-safe string', () => {
    expect(generateTempPassword()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
