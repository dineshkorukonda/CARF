import crypto from "node:crypto";

/**
 * Verifies GitHub's X-Hub-Signature-256 HMAC over the raw (unparsed) webhook body.
 * Must run against the raw request bytes, not a re-serialized JSON.parse() result —
 * whitespace/key-order differences would break the HMAC comparison.
 */
export function verifyGithubSignature(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false;

  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const actualBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
