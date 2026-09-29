import crypto from "node:crypto";

export interface GeneratedInstallToken {
  token: string;
  hash: string;
  prefix: string;
}

/**
 * Generate a cryptographically random, high-entropy install token.
 * Prefixed with `carf_inst_` for easy secret-scanning and identification.
 */
export function generateInstallToken(): GeneratedInstallToken {
  const entropy = crypto.randomBytes(24).toString("hex"); // 48 hex chars
  const token = `carf_inst_${entropy}`;
  const hash = hashInstallToken(token);
  const prefix = token.slice(0, 14); // e.g. "carf_inst_a1b2"
  return { token, hash, prefix };
}

/**
 * Securely hashes the install token at rest (SHA-256 hex digest).
 */
export function hashInstallToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Compares a raw token against a stored SHA-256 hash in constant time.
 */
export function verifyInstallToken(rawToken: string, storedHash: string): boolean {
  if (!rawToken || !storedHash) return false;
  const computedHash = hashInstallToken(rawToken);
  try {
    const computedBuf = Buffer.from(computedHash, "hex");
    const storedBuf = Buffer.from(storedHash, "hex");
    if (computedBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch {
    return false;
  }
}
