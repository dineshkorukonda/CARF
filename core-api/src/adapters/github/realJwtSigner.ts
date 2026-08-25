import jwt from "jsonwebtoken";
import type { JwtSigner } from "./installationTokenClient.js";

// GitHub caps App JWTs at 10 minutes; matches installationTokenClient.ts's own
// REFRESH_BUFFER_MS comment about tokens needing a safety margin before expiry.
const APP_JWT_EXPIRES_IN = "10m";

/**
 * Real `JwtSigner`: signs a GitHub App JWT (RS256, `iss` = App ID, ~10 minute expiry)
 * from the App's PEM-encoded private key. Synchronous, matching the `JwtSigner`
 * interface's contract — `jsonwebtoken`'s `sign()` returns a string directly when called
 * without a callback.
 */
export class RealJwtSigner implements JwtSigner {
  sign(appId: string, privateKey: string): string {
    return jwt.sign({}, privateKey, {
      algorithm: "RS256",
      issuer: appId,
      expiresIn: APP_JWT_EXPIRES_IN,
    });
  }
}
