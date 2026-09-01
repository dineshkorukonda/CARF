// Regression suite for the six defects found reviewing the password-reset feature.
// Each test here failed first, against the code as it was, and only then was the fix
// written. They exist so a defect that was fixed once cannot come back unnoticed.
//
// .agents/rules/coding.md calls this category "Redundant" tests. The tests below are
// deliberately redundant with test/lib/passwordReset.test.ts and test/routes/auth.test.ts:
// those describe what the feature does, these pin what it must never do again.

import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env";
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

/**
 * In-memory stand-in for the slice of Prisma these functions use. `$transaction` snapshots
 * both tables and restores them if the callback throws, so "the write was rolled back" is
 * a property the fake really has rather than one the test merely asserts.
 */
class FakePrisma implements PasswordResetPrismaClient {
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

  $transaction = async <T>(fn: (tx: PasswordResetPrismaClient) => Promise<T>): Promise<T> => {
    const accountSnapshot = this.accounts.map((a) => ({ ...a }));
    const tokenSnapshot = this.tokens.map((t) => ({ ...t }));
    try {
      return await fn(this);
    } catch (err) {
      this.accounts = accountSnapshot;
      this.tokens = tokenSnapshot;
      throw err;
    }
  };
}

const HOUR_MS = 60 * 60 * 1000;

function seed(db: FakePrisma, passwordHash = "original-hash"): FakeAccount {
  const row: FakeAccount = { id: "account-1", email: "user@example.com", passwordHash, sessionVersion: 0 };
  db.accounts.push(row);
  return row;
}

describe("defect 3: redeeming a token and setting the password are atomic", () => {
  let db: FakePrisma;

  beforeEach(() => {
    db = new FakePrisma();
    seed(db);
  });

  it("sets the new password and marks the token used on success", async () => {
    const issued = (await createPasswordResetToken(db, "user@example.com"))!;

    await expect(resetPasswordWithToken(db, issued.token, "a-brand-new-password")).resolves.toBe(true);

    expect(await bcrypt.compare("a-brand-new-password", db.accounts[0]!.passwordHash)).toBe(true);
    expect(db.tokens[0]!.usedAt).not.toBeNull();
  });

  // Previously the route marked the token used, then called updatePassword separately. A
  // failure in that second step burned the user's only link while leaving the password
  // unchanged, forcing them to request a new one.
  it("leaves the token unused when the password update fails", async () => {
    const issued = (await createPasswordResetToken(db, "user@example.com"))!;
    db.account.update = async () => {
      throw new Error("database went away mid-reset");
    };

    await expect(resetPasswordWithToken(db, issued.token, "a-brand-new-password")).rejects.toThrow(
      "database went away mid-reset"
    );

    expect(db.tokens[0]!.usedAt).toBeNull();
    expect(db.accounts[0]!.passwordHash).toBe("original-hash");
  });

  it("still refuses a token that was already redeemed", async () => {
    const issued = (await createPasswordResetToken(db, "user@example.com"))!;
    await resetPasswordWithToken(db, issued.token, "first-new-password");

    await expect(resetPasswordWithToken(db, issued.token, "second-new-password")).resolves.toBe(false);
    expect(await bcrypt.compare("first-new-password", db.accounts[0]!.passwordHash)).toBe(true);
  });

  it("refuses an expired or unknown token without touching the account", async () => {
    await expect(resetPasswordWithToken(db, "not-a-real-token", "x")).resolves.toBe(false);

    const issued = (await createPasswordResetToken(db, "user@example.com"))!;
    db.tokens[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(resetPasswordWithToken(db, issued.token, "x")).resolves.toBe(false);

    expect(db.accounts[0]!.passwordHash).toBe("original-hash");
  });

  // A reset exists to lock somebody out, so it must revoke old sessions exactly as the
  // account settings change-password form does.
  it("bumps sessionVersion, so a reset revokes existing sessions", async () => {
    const issued = (await createPasswordResetToken(db, "user@example.com"))!;

    await resetPasswordWithToken(db, issued.token, "a-brand-new-password");

    expect(db.accounts[0]!.sessionVersion).toBe(1);
  });
});

describe("defect 2: reset requests are rate limited per account", () => {
  let db: FakePrisma;

  beforeEach(() => {
    db = new FakePrisma();
    seed(db);
  });

  it("issues tokens up to the hourly cap", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(createPasswordResetToken(db, "user@example.com")).resolves.not.toBeNull();
    }
  });

  // Without a cap, anyone could flood a victim's inbox and drain the SMTP quota simply by
  // submitting the form in a loop.
  it("refuses the sixth request within an hour", async () => {
    for (let i = 0; i < 5; i++) await createPasswordResetToken(db, "user@example.com");

    await expect(createPasswordResetToken(db, "user@example.com")).resolves.toBeNull();
  });

  it("allows a request again once the earlier ones fall outside the window", async () => {
    const start = Date.parse("2026-01-01T00:00:00Z");
    for (let i = 0; i < 5; i++) await createPasswordResetToken(db, "user@example.com", start);
    // Backdate what was just written, standing in for an hour of real elapsed time.
    for (const t of db.tokens) t.createdAt = new Date(start);

    await expect(createPasswordResetToken(db, "user@example.com", start + HOUR_MS + 1)).resolves.not.toBeNull();
  });

  // The cap counts rows, so the invalidation of earlier tokens must not delete them --
  // otherwise the counter resets on every request and the limit never triggers.
  it("invalidates earlier tokens by marking them used, keeping them countable", async () => {
    const first = (await createPasswordResetToken(db, "user@example.com"))!;
    await createPasswordResetToken(db, "user@example.com");

    expect(db.tokens).toHaveLength(2);
    expect(db.tokens[0]!.usedAt).not.toBeNull();
    await expect(resetPasswordWithToken(db, first.token, "x-brand-new-password")).resolves.toBe(false);
  });

  it("counts per account, so one account cannot exhaust another's allowance", async () => {
    db.accounts.push({ id: "account-2", email: "other@example.com", passwordHash: "h", sessionVersion: 0 });
    for (let i = 0; i < 5; i++) await createPasswordResetToken(db, "user@example.com");

    await expect(createPasswordResetToken(db, "other@example.com")).resolves.not.toBeNull();
  });
});

describe("defect 6: long-expired tokens are cleaned up", () => {
  let db: FakePrisma;

  beforeEach(() => {
    db = new FakePrisma();
    seed(db);
  });

  it("removes tokens that expired more than 24 hours ago", async () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    db.tokens.push({
      id: "ancient",
      tokenHash: createHash("sha256").update("ancient").digest("hex"),
      accountId: "account-1",
      expiresAt: new Date(now - 48 * HOUR_MS),
      usedAt: null,
      createdAt: new Date(now - 48 * HOUR_MS),
    });

    await createPasswordResetToken(db, "user@example.com", now);

    expect(db.tokens.find((t) => t.id === "ancient")).toBeUndefined();
  });

  // A token that expired minutes ago is still worth keeping: it feeds the rate-limit count
  // and lets a user who clicks a just-stale link be told the link expired.
  it("keeps a token that expired only recently", async () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    db.tokens.push({
      id: "recent",
      tokenHash: createHash("sha256").update("recent").digest("hex"),
      accountId: "account-1",
      expiresAt: new Date(now - HOUR_MS),
      usedAt: null,
      createdAt: new Date(now - 2 * HOUR_MS),
    });

    await createPasswordResetToken(db, "user@example.com", now);

    expect(db.tokens.find((t) => t.id === "recent")).toBeDefined();
  });
});

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
