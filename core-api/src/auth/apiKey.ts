import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "carf_";

/**
 * Generates a fresh installation API key: a high-entropy (24 random bytes, base64url)
 * opaque token, plus the SHA-256 hash that's actually persisted (see
 * InstallationApiKey.keyHash) -- the plaintext is only ever returned here, at creation
 * time, and never stored or logged again after that.
 */
export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  return { plaintext, hash: hashApiKey(plaintext) };
}

/**
 * SHA-256 (not a slow/salted hash like bcrypt) is intentional: this hashes a 24-byte
 * random token, not a low-entropy human password, so there's no dictionary/brute-force
 * risk a slow hash would defend against -- the entropy itself is the defense, and a fast
 * hash keeps the auth check cheap on every request.
 */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
