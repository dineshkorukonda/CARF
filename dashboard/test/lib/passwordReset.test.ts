import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createPasswordResetToken,
  redeemPasswordResetToken,
  type PasswordResetPrismaClient,
} from "../../src/lib/passwordReset";

interface FakeAccount {
  id: string;
  email: string;
}

interface FakeToken {
  id: string;
  tokenHash: string;
  accountId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

class FakePasswordResetPrismaClient implements PasswordResetPrismaClient {
  accounts: FakeAccount[] = [];
  tokens = new Map<string, FakeToken>();
  private nextId = 1;

  account = {
    findUnique: async (args: { where: { email: string } }) =>
      this.accounts.find((a) => a.email === args.where.email) ?? null,
  };

  passwordResetToken = {
    create: async (args: { data: { tokenHash: string; accountId: string; expiresAt: Date } }) => {
      const row: FakeToken = { id: `token-${this.nextId++}`, usedAt: null, ...args.data };
      this.tokens.set(row.id, row);
      return row;
    },
    findUnique: async (args: { where: { tokenHash: string } }) =>
      [...this.tokens.values()].find((t) => t.tokenHash === args.where.tokenHash) ?? null,
    update: async (args: { where: { id: string }; data: { usedAt: Date } }) => {
      const existing = this.tokens.get(args.where.id);
      if (!existing) throw new Error(`no token ${args.where.id}`);
      const updated = { ...existing, ...args.data };
      this.tokens.set(existing.id, updated);
      return updated;
    },
    deleteMany: async (args: { where: { accountId: string } }) => {
      for (const [id, token] of this.tokens) {
        if (token.accountId === args.where.accountId) this.tokens.delete(id);
      }
    },
  };
}

describe("createPasswordResetToken / redeemPasswordResetToken", () => {
  it("returns null for an unknown email, without creating a token", async () => {
    const prisma = new FakePasswordResetPrismaClient();

    const result = await createPasswordResetToken(prisma, "nobody@example.com");

    expect(result).toBeNull();
    expect(prisma.tokens.size).toBe(0);
  });

  it("issues a token whose hash (not the raw value) is stored", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    prisma.accounts.push({ id: "account-1", email: "a@example.com" });

    const issued = await createPasswordResetToken(prisma, "a@example.com");

    expect(issued).not.toBeNull();
    const stored = [...prisma.tokens.values()][0]!;
    expect(stored.tokenHash).toBe(createHash("sha256").update(issued!.token).digest("hex"));
    expect(stored.tokenHash).not.toBe(issued!.token);
  });

  it("invalidates any earlier token for the account when a new one is requested", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    prisma.accounts.push({ id: "account-1", email: "a@example.com" });

    const first = await createPasswordResetToken(prisma, "a@example.com");
    await createPasswordResetToken(prisma, "a@example.com");

    expect(await redeemPasswordResetToken(prisma, first!.token)).toBeNull();
  });

  it("redeems a valid token exactly once", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    prisma.accounts.push({ id: "account-1", email: "a@example.com" });
    const issued = await createPasswordResetToken(prisma, "a@example.com");

    const redeemed = await redeemPasswordResetToken(prisma, issued!.token);
    expect(redeemed).toEqual({ accountId: "account-1" });

    const secondAttempt = await redeemPasswordResetToken(prisma, issued!.token);
    expect(secondAttempt).toBeNull();
  });

  it("rejects an expired token", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    prisma.accounts.push({ id: "account-1", email: "a@example.com" });
    const now = Date.now();
    const issued = await createPasswordResetToken(prisma, "a@example.com", now);

    const redeemed = await redeemPasswordResetToken(prisma, issued!.token, now + 31 * 60 * 1000);
    expect(redeemed).toBeNull();
  });

  it("rejects a garbage token", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    expect(await redeemPasswordResetToken(prisma, "not-a-real-token")).toBeNull();
  });
});
