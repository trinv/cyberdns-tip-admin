import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

// scrypt is Node's built-in, no extra dependency needed (bcrypt/argon2 would
// require a native addon). Stored format: "saltHex:derivedKeyHex".
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

// Burns the same work `verifyPassword` would (one scrypt + one
// timingSafeEqual) without needing a real stored hash — call it on the
// "no such user" / "user disabled" login paths so an attacker can't tell
// from response time whether an email maps to a real account. The salt is
// a fixed constant on purpose: this comparison is never expected to
// succeed, it exists only to spend CPU time.
const DECOY_SALT = 'cyberdns-tip-login-timing-decoy';
const DECOY_KEY = Buffer.alloc(KEY_LENGTH);
export async function burnPasswordCompare(password: string): Promise<void> {
  try {
    const derived = (await scrypt(password, DECOY_SALT, KEY_LENGTH)) as Buffer;
    timingSafeEqual(derived, DECOY_KEY);
  } catch {
    // Never let the decoy path itself throw into the caller.
  }
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuf = Buffer.from(hashHex, 'hex');
  // Guard the length check before timingSafeEqual, which throws on mismatched
  // buffer lengths rather than just returning false.
  if (storedBuf.length !== derived.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

// A random, pronounceable-enough temporary password for the bootstrap admin
// account and for admin-issued "create user" flows where no password was
// explicitly supplied.
export function generateTempPassword(): string {
  return randomBytes(12).toString('base64url');
}
