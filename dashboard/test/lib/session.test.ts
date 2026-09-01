import { describe, expect, it } from "vitest";
import { createSessionCookieValue, verifySessionCookieValue } from "../../src/lib/session";

const SECRET = "test-secret";

describe("session cookie sign/verify", () => {
  it("round-trips a freshly created cookie value", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const value = createSessionCookieValue(SECRET, "account-1", 0, now);
    const result = verifySessionCookieValue(SECRET, value, now);
    expect(result).toEqual({ accountId: "account-1", sessionVersion: 0 });
  });

  it("round-trips a non-zero session version", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const value = createSessionCookieValue(SECRET, "account-1", 7, now);
    expect(verifySessionCookieValue(SECRET, value, now)).toEqual({ accountId: "account-1", sessionVersion: 7 });
  });

  it("rejects a cookie value past its expiry", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const value = createSessionCookieValue(SECRET, "account-1", 0, now);
    const thirtyOneDaysLater = now + 31 * 24 * 60 * 60 * 1000;
    expect(verifySessionCookieValue(SECRET, value, thirtyOneDaysLater)).toBeNull();
  });

  it("rejects a cookie value signed with a different secret", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const value = createSessionCookieValue("other-secret", "account-1", 0, now);
    expect(verifySessionCookieValue(SECRET, value, now)).toBeNull();
  });

  it("rejects a tampered accountId (signature no longer matches)", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const value = createSessionCookieValue(SECRET, "account-1", 0, now);
    const [, sessionVersion, expiresAt, signature] = value.split(".");
    const tampered = `account-2.${sessionVersion}.${expiresAt}.${signature}`;
    expect(verifySessionCookieValue(SECRET, tampered, now)).toBeNull();
  });

  it("rejects a tampered sessionVersion (signature no longer matches)", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const value = createSessionCookieValue(SECRET, "account-1", 0, now);
    const [accountId, , expiresAt, signature] = value.split(".");
    const tampered = `${accountId}.99.${expiresAt}.${signature}`;
    expect(verifySessionCookieValue(SECRET, tampered, now)).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(verifySessionCookieValue(SECRET, "not-a-valid-cookie", Date.now())).toBeNull();
    expect(verifySessionCookieValue(SECRET, undefined, Date.now())).toBeNull();
    expect(verifySessionCookieValue(SECRET, null, Date.now())).toBeNull();
    expect(verifySessionCookieValue(SECRET, "", Date.now())).toBeNull();
  });

  // Cookies minted before Account.sessionVersion existed used a 3-part format. They must
  // fail closed rather than parse as version 0, which is why the deploy signs everyone out.
  it("rejects a legacy 3-part cookie value", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(verifySessionCookieValue(SECRET, `account-1.${now + 1000}.deadbeef`, now)).toBeNull();
  });
});
