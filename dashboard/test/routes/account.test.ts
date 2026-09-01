import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const BASE_URL = "http://localhost:3000";

interface FakeAccount {
  id: string;
  email: string;
  passwordHash: string;
  sessionVersion: number;
  createdAt: Date;
}

let accounts: FakeAccount[] = [];
const getCurrentAccount = vi.fn();

vi.mock("../../src/config/env", () => ({
  env: { baseUrl: () => BASE_URL },
}));

vi.mock("../../src/lib/auth", () => ({
  getCurrentAccount: () => getCurrentAccount(),
}));

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    account: {
      update: async (args: {
        where: { id: string };
        data: { passwordHash: string; sessionVersion?: { increment: number } };
      }) => {
        const row = accounts.find((a) => a.id === args.where.id);
        if (!row) throw new Error(`no account ${args.where.id}`);
        const { sessionVersion, ...rest } = args.data;
        Object.assign(row, rest);
        if (sessionVersion) row.sessionVersion += sessionVersion.increment;
        return row;
      },
    },
  },
}));

const { POST: changePassword } = await import("../../src/app/api/account/change-password/route");

function formRequest(fields: Record<string, string>): NextRequest {
  return new NextRequest(`${BASE_URL}/api/account/change-password`, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

function location(response: Response): string {
  const url = new URL(response.headers.get("location")!);
  return url.pathname + url.search;
}

beforeEach(() => {
  accounts = [
    { id: "account-1", email: "user@example.com", passwordHash: "old-hash", sessionVersion: 0, createdAt: new Date() },
  ];
  getCurrentAccount.mockReset();
});

describe("POST /api/account/change-password", () => {
  it("stores a new bcrypt hash and reports success", async () => {
    getCurrentAccount.mockResolvedValue(accounts[0]);

    const response = await changePassword(formRequest({ newPassword: "a-brand-new-password" }));

    expect(location(response)).toBe("/dashboard/account?saved=1");
    expect(await bcrypt.compare("a-brand-new-password", accounts[0]!.passwordHash)).toBe(true);
  });

  // This route changes a credential, so an unauthenticated caller must be turned away
  // before the form is even read. Nothing proved that before this suite.
  it("redirects an unauthenticated caller to /login and changes nothing", async () => {
    getCurrentAccount.mockResolvedValue(null);

    const response = await changePassword(formRequest({ newPassword: "a-brand-new-password" }));

    expect(location(response)).toBe("/login");
    expect(accounts[0]!.passwordHash).toBe("old-hash");
  });

  it("rejects a password under 8 characters and leaves the old one in place", async () => {
    getCurrentAccount.mockResolvedValue(accounts[0]);

    const response = await changePassword(formRequest({ newPassword: "short" }));

    expect(location(response)).toBe("/dashboard/account?error=invalid_password");
    expect(accounts[0]!.passwordHash).toBe("old-hash");
  });

  it("rejects a missing newPassword field", async () => {
    getCurrentAccount.mockResolvedValue(accounts[0]);

    const response = await changePassword(formRequest({}));

    expect(location(response)).toBe("/dashboard/account?error=invalid_password");
    expect(accounts[0]!.passwordHash).toBe("old-hash");
  });

  // The account id comes from the verified session cookie, never from the submitted form,
  // so a caller cannot aim the change at somebody else's account.
  it("changes the signed-in account, ignoring any accountId in the form", async () => {
    accounts.push({
      id: "account-2",
      email: "other@example.com",
      passwordHash: "victim-hash",
      sessionVersion: 0,
      createdAt: new Date(),
    });
    getCurrentAccount.mockResolvedValue(accounts[0]);

    await changePassword(formRequest({ newPassword: "a-brand-new-password", accountId: "account-2" }));

    expect(accounts[1]!.passwordHash).toBe("victim-hash");
    expect(accounts[0]!.passwordHash).not.toBe("old-hash");
  });
});
