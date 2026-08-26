import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "carf_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionPayload {
  accountId: string;
}

function sign(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Cookie value format: `<accountId>.<expiresAtMs>.<hmacHex>`. No encryption -- accountId
 * is an opaque cuid, not sensitive on its own -- only integrity (can't be forged/tampered)
 * and expiry matter here, both of which HMAC + a timestamp field give us.
 */
export function createSessionCookieValue(secret: string, accountId: string, now: number = Date.now()): string {
  const expiresAt = now + SESSION_TTL_MS;
  const data = `${accountId}.${expiresAt}`;
  return `${data}.${sign(secret, data)}`;
}

/**
 * Verifies signature (constant-time) and expiry. Returns null on any failure -- malformed
 * value, bad signature, or expired -- callers treat null uniformly as "not logged in"
 * rather than distinguishing why, since none of those cases should behave differently.
 */
export function verifySessionCookieValue(
  secret: string,
  value: string | undefined | null,
  now: number = Date.now()
): SessionPayload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [accountId, expiresAtStr, signature] = parts as [string, string, string];

  const data = `${accountId}.${expiresAtStr}`;
  const expectedHex = sign(secret, data);
  const expectedBuf = Buffer.from(expectedHex, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return null;
  }

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return null;

  return { accountId };
}
