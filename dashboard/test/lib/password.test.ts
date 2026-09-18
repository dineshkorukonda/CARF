import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/password";

describe("password utility", () => {
  it("hashes and verifies a password correctly", () => {
    const password = "super-secret-password-123";
    const hashed = hashPassword(password);

    expect(hashed).toContain(":");
    expect(verifyPassword(password, hashed)).toBe(true);
    expect(verifyPassword("wrong-password", hashed)).toBe(false);
  });

  it("produces unique hashes for the same password due to random salt", () => {
    const password = "same-password";
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(verifyPassword(password, hash1)).toBe(true);
    expect(verifyPassword(password, hash2)).toBe(true);
  });

  it("handles malformed or invalid hash formats safely", () => {
    expect(verifyPassword("password", "")).toBe(false);
    expect(verifyPassword("password", "malformed")).toBe(false);
    expect(verifyPassword("password", "salt:invalidhex")).toBe(false);
  });
});
