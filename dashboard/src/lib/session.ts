import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "carf_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionPayload {
  accountId: string;
  sessionVersion: number;
}

function sign(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Cookie value format: `<accountId>.<sessionVersion>.<expiresAtMs>.<hmacHex>`. No
 * encryption -- accountId is an opaque cuid, not sensitive on its own -- only integrity
 * (can't be forged/tampered) and expiry matter here, both of which HMAC + a timestamp
 * field give us.
 *
 * `sessionVersion` is the Account's counter at the moment the cookie was minted. Signing
 * it in is what lets a password change revoke sessions: getCurrentAccount compares this
 * value against the account's current one. Expiry alone couldn't do that, since a stolen
 * cookie is valid for the full SESSION_TTL_MS regardless of what the owner does.
 */
export function createSessionCookieValue(
  secret: string,
  accountId: string,
  sessionVersion: number,
  now: number = Date.now()
): string {
  const expiresAt = now + SESSION_TTL_MS;
  const data = `${accountId}.${sessionVersion}.${expiresAt}`;
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
  if (parts.length !== 4) return null;
  const [accountId, sessionVersionStr, expiresAtStr, signature] = parts as [string, string, string, string];

  const data = `${accountId}.${sessionVersionStr}.${expiresAtStr}`;
  const expectedHex = sign(secret, data);
  const expectedBuf = Buffer.from(expectedHex, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return null;
  }

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return null;

  const sessionVersion = Number(sessionVersionStr);
  if (!Number.isInteger(sessionVersion)) return null;

  return { accountId, sessionVersion };
}
