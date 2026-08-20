import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGithubSignature } from "../../../src/adapters/github/webhookSignature.js";

const secret = "test-webhook-secret";
const rawBody = JSON.stringify({ hello: "world" });

function sign(body: string, withSecret: string): string {
  return "sha256=" + crypto.createHmac("sha256", withSecret).update(body).digest("hex");
}

describe("verifyGithubSignature", () => {
  it("accepts a correctly signed payload", () => {
    expect(verifyGithubSignature(rawBody, sign(rawBody, secret), secret)).toBe(true);
  });

  it("rejects a missing signature header", () => {
    expect(verifyGithubSignature(rawBody, undefined, secret)).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", () => {
    expect(verifyGithubSignature(rawBody, sign(rawBody, "wrong-secret"), secret)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const validSig = sign(rawBody, secret);
    expect(verifyGithubSignature(JSON.stringify({ hello: "tampered" }), validSig, secret)).toBe(false);
  });

  it("does not throw on a malformed signature header of different length", () => {
    expect(() => verifyGithubSignature(rawBody, "sha256=not-hex", secret)).not.toThrow();
    expect(verifyGithubSignature(rawBody, "sha256=not-hex", secret)).toBe(false);
  });
});
