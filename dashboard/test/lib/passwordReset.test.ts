import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createPasswordResetToken,
  resetPasswordWithToken,
  type PasswordResetPrismaClient,
} from "../../src/lib/passwordReset";

interface FakeAccount {
  id: string;
  email: string;
  passwordHash: string;
  sessionVersion: number;
}

interface FakeToken {
  id: string;
  tokenHash: string;
  accountId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

class FakePasswordResetPrismaClient implements PasswordResetPrismaClient {
  accounts: FakeAccount[] = [];
  tokens: FakeToken[] = [];
  private nextId = 1;

  account = {
    findUnique: async (args: { where: { email: string } }) =>
      this.accounts.find((a) => a.email === args.where.email) ?? null,
    update: async (args: {
      where: { id: string };
      data: { passwordHash: string; sessionVersion: { increment: number } };
    }) => {
      const row = this.accounts.find((a) => a.id === args.where.id);
      if (!row) throw new Error(`no account ${args.where.id}`);
      row.passwordHash = args.data.passwordHash;
      row.sessionVersion += args.data.sessionVersion.increment;
      return row;
    },
  };

  passwordResetToken = {
    create: async (args: { data: { tokenHash: string; accountId: string; expiresAt: Date } }) => {
      const row: FakeToken = { id: `token-${this.nextId++}`, usedAt: null, createdAt: new Date(), ...args.data };
      this.tokens.push(row);
      return row;
    },
    findUnique: async (args: { where: { tokenHash: string } }) =>
      this.tokens.find((t) => t.tokenHash === args.where.tokenHash) ?? null,
    update: async (args: { where: { id: string }; data: { usedAt: Date } }) => {
      const row = this.tokens.find((t) => t.id === args.where.id);
      if (!row) throw new Error(`no token ${args.where.id}`);
      row.usedAt = args.data.usedAt;
      return row;
    },
    updateMany: async (args: { where: { accountId: string; usedAt: null }; data: { usedAt: Date } }) => {
      let count = 0;
      for (const t of this.tokens) {
        if (t.accountId === args.where.accountId && t.usedAt === null) {
          t.usedAt = args.data.usedAt;
          count++;
        }
      }
      return { count };
    },
    count: async (args: { where: { accountId: string; createdAt: { gte: Date } } }) =>
      this.tokens.filter(
        (t) => t.accountId === args.where.accountId && t.createdAt.getTime() >= args.where.createdAt.gte.getTime()
      ).length,
    deleteMany: async (args: { where: { accountId: string; expiresAt: { lt: Date } } }) => {
      const before = this.tokens.length;
      this.tokens = this.tokens.filter(
        (t) => !(t.accountId === args.where.accountId && t.expiresAt.getTime() < args.where.expiresAt.lt.getTime())
      );
      return { count: before - this.tokens.length };
    },
  };

  $transaction = async <T>(fn: (tx: PasswordResetPrismaClient) => Promise<T>): Promise<T> => fn(this);

  seedAccount(email = "a@example.com"): FakeAccount {
    const row: FakeAccount = { id: "account-1", email, passwordHash: "original-hash", sessionVersion: 0 };
    this.accounts.push(row);
    return row;
  }
}

describe("createPasswordResetToken", () => {
  it("returns null for an unknown email, without creating a token", async () => {
    const prisma = new FakePasswordResetPrismaClient();

    const result = await createPasswordResetToken(prisma, "nobody@example.com");

    expect(result).toBeNull();
    expect(prisma.tokens).toHaveLength(0);
  });

  it("issues a token whose hash (not the raw value) is stored", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    prisma.seedAccount();

    const issued = await createPasswordResetToken(prisma, "a@example.com");

    expect(issued).not.toBeNull();
    const stored = prisma.tokens[0]!;
    expect(stored.tokenHash).toBe(createHash("sha256").update(issued!.token).digest("hex"));
    expect(stored.tokenHash).not.toBe(issued!.token);
  });

  it("invalidates any earlier token for the account when a new one is requested", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    prisma.seedAccount();

    const first = await createPasswordResetToken(prisma, "a@example.com");
    await createPasswordResetToken(prisma, "a@example.com");

    expect(await resetPasswordWithToken(prisma, first!.token, "a-brand-new-password")).toBe(false);
  });

  it("issues a token that expires 30 minutes out", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    prisma.seedAccount();
    const now = Date.parse("2026-01-01T00:00:00Z");

    await createPasswordResetToken(prisma, "a@example.com", now);

    expect(prisma.tokens[0]!.expiresAt.getTime()).toBe(now + 30 * 60 * 1000);
  });
});

describe("resetPasswordWithToken", () => {
  it("redeems a valid token exactly once", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    prisma.seedAccount();
    const issued = await createPasswordResetToken(prisma, "a@example.com");

    expect(await resetPasswordWithToken(prisma, issued!.token, "a-brand-new-password")).toBe(true);
    expect(await resetPasswordWithToken(prisma, issued!.token, "another-new-password")).toBe(false);
  });

  it("stores the new password as a hash, never in plaintext", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    prisma.seedAccount();
    const issued = await createPasswordResetToken(prisma, "a@example.com");

    await resetPasswordWithToken(prisma, issued!.token, "a-brand-new-password");

    expect(prisma.accounts[0]!.passwordHash).not.toBe("a-brand-new-password");
    expect(await bcrypt.compare("a-brand-new-password", prisma.accounts[0]!.passwordHash)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const prisma = new FakePasswordResetPrismaClient();
    prisma.seedAccount();
    const now = Date.now();
    const issued = await createPasswordResetToken(prisma, "a@example.com", now);

    expect(await resetPasswordWithToken(prisma, issued!.token, "x", now + 31 * 60 * 1000)).toBe(false);
  });

  it("rejects a garbage token", async () => {
    const prisma = new FakePasswordResetPrismaClient();

    expect(await resetPasswordWithToken(prisma, "not-a-real-token", "x")).toBe(false);
  });
});
