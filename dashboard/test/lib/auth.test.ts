import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionCookieValue } from "../../src/lib/session";

// getCurrentAccount is the single gate every authenticated page and route handler goes
// through, and it imports `next/headers` and the Prisma singleton directly rather than
// taking them as arguments. Mock those two modules rather than reshaping production code
// to suit the test.
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

const ACCOUNT = {
  id: "account-1",
  email: "someone@example.com",
  passwordHash: "$2a$12$hash",
  sessionVersion: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

describe("getCurrentAccount", () => {
  beforeEach(() => {
    cookieGet.mockReset();
    accountFindUnique.mockReset();
  });

  it("returns the account for a validly signed, unexpired cookie", async () => {
    cookieGet.mockReturnValue({ value: createSessionCookieValue(SECRET, "account-1", 0) });
    accountFindUnique.mockResolvedValue(ACCOUNT);

    await expect(getCurrentAccount()).resolves.toEqual(ACCOUNT);
    expect(accountFindUnique).toHaveBeenCalledWith({ where: { id: "account-1" } });
  });

  it("reads the session from the carf_session cookie", async () => {
    cookieGet.mockReturnValue({ value: createSessionCookieValue(SECRET, "account-1", 0) });
    accountFindUnique.mockResolvedValue(ACCOUNT);

    await getCurrentAccount();

    expect(cookieGet).toHaveBeenCalledWith("carf_session");
  });

  it("returns null when no session cookie is present, without querying the database", async () => {
    cookieGet.mockReturnValue(undefined);

    await expect(getCurrentAccount()).resolves.toBeNull();
    expect(accountFindUnique).not.toHaveBeenCalled();
  });

  // The signature check is the only thing standing between a guessed accountId and a
  // logged-in session, so a forged cookie must never reach the database lookup.
  it("returns null for a cookie signed with a different secret, without querying", async () => {
    cookieGet.mockReturnValue({ value: createSessionCookieValue("attacker-secret", "account-1") });

    await expect(getCurrentAccount()).resolves.toBeNull();
    expect(accountFindUnique).not.toHaveBeenCalled();
  });

  it("returns null for a tampered accountId, without querying", async () => {
    const valid = createSessionCookieValue(SECRET, "account-1", 0);
    const [, sessionVersion, expiresAt, signature] = valid.split(".");
    cookieGet.mockReturnValue({ value: `account-2.${sessionVersion}.${expiresAt}.${signature}` });

    await expect(getCurrentAccount()).resolves.toBeNull();
    expect(accountFindUnique).not.toHaveBeenCalled();
  });

  it("returns null for an expired cookie, without querying", async () => {
    const issuedLongAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    cookieGet.mockReturnValue({ value: createSessionCookieValue(SECRET, "account-1", 0, issuedLongAgo) });

    await expect(getCurrentAccount()).resolves.toBeNull();
    expect(accountFindUnique).not.toHaveBeenCalled();
  });

  it("returns null for a malformed cookie value", async () => {
    cookieGet.mockReturnValue({ value: "garbage" });

    await expect(getCurrentAccount()).resolves.toBeNull();
    expect(accountFindUnique).not.toHaveBeenCalled();
  });

  // A cookie can outlive the row it points at (account deleted mid-session). Callers treat
  // null as "not logged in", so this must not throw.
  it("returns null when the signed account no longer exists", async () => {
    cookieGet.mockReturnValue({ value: createSessionCookieValue(SECRET, "deleted-account") });
    accountFindUnique.mockResolvedValue(null);

    await expect(getCurrentAccount()).resolves.toBeNull();
  });
});
