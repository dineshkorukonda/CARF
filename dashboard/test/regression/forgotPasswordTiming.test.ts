// Regression: defect 4 -- the "forgot password" response time must not reveal whether an
// address has an account.
//
// The route awaited the SMTP send. An unknown address returned immediately; a known one
// waited for the mail server, which can take seconds. That difference is trivially
// measurable, so an attacker could enumerate registered addresses despite the identical
// redirect the route goes out of its way to return. The doc comments on this route and on
// createPasswordResetToken both claim enumeration resistance, so the gap contradicted a
// stated guarantee.
//
// The fix starts the send and does not await it. The test proves that by making the send
// never settle: if the route still awaited it, the request would hang forever.

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const BASE_URL = "http://localhost:3000";

interface FakeAccount {
  id: string;
  email: string;
}

let accounts: FakeAccount[] = [];
let tokens: Array<{ id: string; accountId: string; createdAt: Date; usedAt: Date | null; expiresAt: Date }> = [];
const sendPasswordResetEmail = vi.fn();

vi.mock("../../src/config/env", () => ({ env: { baseUrl: () => BASE_URL } }));

vi.mock("../../src/lib/mailer", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    account: {
      findUnique: async (args: { where: { email: string } }) =>
        accounts.find((a) => a.email === args.where.email) ?? null,
    },
    passwordResetToken: {
      create: async (args: { data: { accountId: string; expiresAt: Date } }) => {
        const row = { id: `t-${tokens.length}`, usedAt: null, createdAt: new Date(), ...args.data };
        tokens.push(row);
        return row;
      },
      count: async () => tokens.length,
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
  },
}));

const { POST: forgotPassword } = await import("../../src/app/api/auth/forgot-password/route");

function request(email: string): NextRequest {
  return new NextRequest(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    body: new URLSearchParams({ email }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

beforeEach(() => {
  accounts = [{ id: "account-1", email: "user@example.com" }];
  tokens = [];
  sendPasswordResetEmail.mockReset();
});

describe("defect 4: the response does not wait on the mail server", () => {
  it("redirects without waiting for a send that never settles", async () => {
    // A send that never resolves stands in for a slow or hanging SMTP server. If the route
    // awaited it, this test would time out instead of asserting anything.
    sendPasswordResetEmail.mockReturnValue(new Promise(() => {}));

    const response = await forgotPassword(request("user@example.com"));

    expect(new URL(response.headers.get("location")!).search).toBe("?sent=1");
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  }, 2000);

  it("gives a known and an unknown address the same redirect", async () => {
    sendPasswordResetEmail.mockReturnValue(new Promise(() => {}));

    const known = await forgotPassword(request("user@example.com"));
    const unknown = await forgotPassword(request("nobody@example.com"));

    expect(known.headers.get("location")).toBe(unknown.headers.get("location"));
  }, 2000);

  // Not awaiting a promise must not turn a mail failure into an unhandled rejection, which
  // in production would be logged as a crash or, on some Node versions, end the process.
  it("swallows and logs a rejected send rather than leaving it unhandled", async () => {
    sendPasswordResetEmail.mockRejectedValue(new Error("SMTP unreachable"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await forgotPassword(request("user@example.com"));
    // Let the rejection settle so an unattached handler would surface before the assertion.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(new URL(response.headers.get("location")!).search).toBe("?sent=1");
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
