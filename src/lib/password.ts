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
