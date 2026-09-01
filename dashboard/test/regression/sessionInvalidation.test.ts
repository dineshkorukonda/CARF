// Regression: defect 1 -- a password change must end every session that existed before it.
//
// The session cookie was <accountId>.<expiresAt>.<hmac>. Nothing in it depended on the
// password, and updatePassword only rewrote Account.passwordHash, so a stolen cookie kept
// working for the full 30-day SESSION_TTL_MS after the owner reset their password. Locking
// an intruder out is the main reason anyone resets a password, so the feature did not do
// its primary job.
//
// The fix carries an Account.sessionVersion in the signed cookie and bumps it on every
// password change. getCurrentAccount already loads the account row, so comparing the two
// costs no extra query.
//
// This file lives apart from the other regression tests because it mocks next/headers and
// the Prisma singleton, and vi.mock applies to a whole file.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionCookieValue, verifySessionCookieValue } from "../../src/lib/session";
import { updatePassword, type DashboardPrismaClient } from "../../src/lib/accountService";

const SECRET = "test-session-secret";

const cookieGet = vi.fn();
const accountFindUnique = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => cookieGet(name) }),
}));

vi.mock("../../src/config/env", () => ({
  env: { sessionSecret: () => SECRET },
}));

vi.mock("../../src/lib/prisma", () => ({
  prisma: { account: { findUnique: (args: unknown) => accountFindUnique(args) } },
}));

const { getCurrentAccount } = await import("../../src/lib/auth");

function account(sessionVersion: number) {
  return {
    id: "account-1",
    email: "user@example.com",
    passwordHash: "$2a$12$hash",
    sessionVersion,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

beforeEach(() => {
  cookieGet.mockReset();
  accountFindUnique.mockReset();
});

describe("defect 1: the session cookie carries a version", () => {
  it("round-trips the session version alongside the account id", () => {
    const value = createSessionCookieValue(SECRET, "account-1", 3);

    expect(verifySessionCookieValue(SECRET, value)).toEqual({ accountId: "account-1", sessionVersion: 3 });
  });

  it("still rejects a cookie whose version was tampered with", () => {
    const value = createSessionCookieValue(SECRET, "account-1", 0);
    const [accountId, , expiresAt, signature] = value.split(".");

    expect(verifySessionCookieValue(SECRET, `${accountId}.99.${expiresAt}.${signature}`)).toBeNull();
  });
});

describe("defect 1: a password change bumps the account's session version", () => {
  it("increments sessionVersion in the same update that stores the new hash", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const prisma = {
      account: {
        update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push(args.data);
          return account(1);
        },
      },
    } as unknown as DashboardPrismaClient;

    await updatePassword(prisma, "account-1", "a-brand-new-password");

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ sessionVersion: { increment: 1 } });
    expect(typeof updates[0]!.passwordHash).toBe("string");
  });
});

describe("defect 1: an old session stops working after a password change", () => {
  it("rejects a cookie minted before the password change", async () => {
    // Cookie issued while the account was at version 0...
    cookieGet.mockReturnValue({ value: createSessionCookieValue(SECRET, "account-1", 0) });
    // ...but the password has since changed, taking the account to version 1.
    accountFindUnique.mockResolvedValue(account(1));

    await expect(getCurrentAccount()).resolves.toBeNull();
  });

  it("still accepts a cookie minted after the password change", async () => {
    cookieGet.mockReturnValue({ value: createSessionCookieValue(SECRET, "account-1", 1) });
    accountFindUnique.mockResolvedValue(account(1));

    await expect(getCurrentAccount()).resolves.toEqual(account(1));
  });

  // Every session predating the change must die, not just the most recent one.
  it("rejects a cookie from any earlier version, not only the previous one", async () => {
    accountFindUnique.mockResolvedValue(account(5));

    for (const staleVersion of [0, 1, 2, 3, 4]) {
      cookieGet.mockReturnValue({ value: createSessionCookieValue(SECRET, "account-1", staleVersion) });
      await expect(getCurrentAccount(), `version ${staleVersion} should be rejected`).resolves.toBeNull();
    }
  });
});
