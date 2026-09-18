import crypto from "node:crypto";

const KEY_LEN = 64;

/**
 * Derives a secure scrypt password hash with a random 16-byte salt.
 * Formatted as `${salt}:${derivedKeyHex}`.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Constant-time comparison between input password and stored salt:hash string.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== "string") return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;

  const [salt, key] = parts;
  if (!salt || !key) return false;

  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);

  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}
