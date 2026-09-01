// Regression suite for the six defects found reviewing the password-reset feature.
// Each test here failed first, against the code as it was, and only then was the fix
// written. They exist so a defect that was fixed once cannot come back unnoticed.
//
// .agents/rules/coding.md calls this category "Redundant" tests. The tests below are
// deliberately redundant with test/lib/passwordReset.test.ts and test/routes/auth.test.ts:
// those describe what the feature does, these pin what it must never do again.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env";

describe("defect 5: SMTP_PORT is validated, not silently coerced to NaN", () => {
  const original = process.env.SMTP_PORT;

  afterEach(() => {
    if (original === undefined) delete process.env.SMTP_PORT;
    else process.env.SMTP_PORT = original;
  });

  it("returns the port as a number when the value is a valid port", () => {
    process.env.SMTP_PORT = "587";

    expect(env.smtpPort()).toBe(587);
  });

  // Number("smtp.example.com") is NaN, and requireEnv only rejects an empty value. The
  // bad config used to surface much later as an unrelated socket error.
  it("throws a named error instead of returning NaN for a non-numeric value", () => {
    process.env.SMTP_PORT = "not-a-port";

    expect(() => env.smtpPort()).toThrow(/SMTP_PORT/);
  });

  it("throws for a port that is not a positive integer", () => {
    for (const bad of ["0", "-1", "58.7"]) {
      process.env.SMTP_PORT = bad;
      expect(() => env.smtpPort(), `expected ${bad} to be rejected`).toThrow(/SMTP_PORT/);
    }
  });

  it("throws for a port above the maximum TCP port number", () => {
    process.env.SMTP_PORT = "65536";

    expect(() => env.smtpPort()).toThrow(/SMTP_PORT/);
  });
});
