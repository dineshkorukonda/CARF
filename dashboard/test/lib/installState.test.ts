import { describe, expect, it } from "vitest";
import { GITHUB_APP_INSTALL_STATE_COOKIE, generateInstallState } from "../../src/lib/installState";

describe("generateInstallState", () => {
  it("returns 32 hex characters (16 random bytes)", () => {
    expect(generateInstallState()).toMatch(/^[0-9a-f]{32}$/);
  });

  // The whole point of the nonce is that a third party can't predict the value the install
  // callback will be compared against -- a repeated value would defeat the CSRF check.
  it("returns a different value on every call", () => {
    const values = new Set(Array.from({ length: 100 }, () => generateInstallState()));
    expect(values.size).toBe(100);
  });

  it("exposes the cookie name the install start/callback routes agree on", () => {
    expect(GITHUB_APP_INSTALL_STATE_COOKIE).toBe("carf_install_state");
  });
});
