import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { RealJwtSigner } from "../../../src/adapters/github/realJwtSigner.js";

// Real RSA keypair, generated once per test file — no network, no mocking of
// jsonwebtoken itself, so this test exercises the real signing/verification round trip.
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

describe("RealJwtSigner", () => {
  it("returns a JWT string synchronously (matches the JwtSigner interface, no Promise)", () => {
    const signer = new RealJwtSigner();
    const token = signer.sign("app-123", privateKey);
    expect(typeof token).toBe("string");
  });

  it("signs with RS256 and sets iss to the given App ID, verifiable with the matching public key", () => {
    const signer = new RealJwtSigner();
    const token = signer.sign("app-123", privateKey);

    const payload = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
    expect(typeof payload).toBe("object");
    expect((payload as jwt.JwtPayload).iss).toBe("app-123");
  });

  it("sets an expiry roughly 10 minutes out", () => {
    const signer = new RealJwtSigner();
    const token = signer.sign("app-123", privateKey);

    const payload = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as jwt.JwtPayload;
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(payload.exp).toBeGreaterThan(nowSeconds + 9 * 60);
    expect(payload.exp).toBeLessThanOrEqual(nowSeconds + 10 * 60 + 5);
  });

  it("rejects verification against a different keypair (proves it actually signs with the given private key)", () => {
    const signer = new RealJwtSigner();
    const token = signer.sign("app-123", privateKey);

    const { publicKey: otherPublicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    expect(() => jwt.verify(token, otherPublicKey, { algorithms: ["RS256"] })).toThrow();
  });
});
