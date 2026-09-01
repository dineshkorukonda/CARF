import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "./accountService";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** How many reset links one account may request per hour. Without a cap, anyone can flood
 *  a victim's inbox and drain the SMTP quota by submitting the form in a loop. */
export const RESET_REQUEST_LIMIT = 5;
export const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000;

/** Rows are kept past expiry so they still feed the rate-limit count and so a user who
 *  clicks a just-stale link can be told it expired. A day is long past both uses. */
export const RESET_TOKEN_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface PasswordResetTxClient {
  account: {
    update(args: {
      where: { id: string };
      data: { passwordHash: string; sessionVersion: { increment: number } };
    }): Promise<unknown>;
  };
  passwordResetToken: {
    update(args: { where: { id: string }; data: { usedAt: Date } }): Promise<unknown>;
  };
}

/**
 * Structural subset of the generated Prisma client this module needs -- same
 * interface-injection pattern as accountService.ts's DashboardPrismaClient, so tests
 * supply an in-memory fake.
 */
export interface PasswordResetPrismaClient {
  account: {
    findUnique(args: { where: { email: string } }): Promise<{ id: string } | null>;
    update(args: {
      where: { id: string };
      data: { passwordHash: string; sessionVersion: { increment: number } };
    }): Promise<unknown>;
  };
  passwordResetToken: {
    create(args: { data: { tokenHash: string; accountId: string; expiresAt: Date } }): Promise<unknown>;
    findUnique(
      args: { where: { tokenHash: string } }
    ): Promise<{ id: string; accountId: string; expiresAt: Date; usedAt: Date | null } | null>;
    update(args: { where: { id: string }; data: { usedAt: Date } }): Promise<unknown>;
    updateMany(args: { where: { accountId: string; usedAt: null }; data: { usedAt: Date } }): Promise<unknown>;
    count(args: { where: { accountId: string; createdAt: { gte: Date } } }): Promise<number>;
    deleteMany(args: { where: { accountId: string; expiresAt: { lt: Date } } }): Promise<unknown>;
  };
  $transaction<T>(fn: (tx: PasswordResetTxClient) => Promise<T>): Promise<T>;
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Looks up the account by email and, if one exists and is under its hourly request cap,
 * issues a fresh single-use reset token. Any earlier unused token for that account is
 * marked used first, so an old leaked link stops working the moment a new one is
 * requested.
 *
 * Earlier tokens are *marked used*, not deleted: the rate-limit count works by counting
 * rows, so deleting them would reset the counter on every request and the cap would never
 * trigger. Rows that expired over RESET_TOKEN_RETENTION_MS ago are swept here instead, in
 * the same pass, which is why no scheduled job is needed.
 *
 * Returns null for an unknown email *and* for a rate-limited one -- callers must respond
 * identically in every case (a generic "check your inbox" message) to avoid leaking which
 * emails are registered; see api/auth/forgot-password/route.ts.
 */
export async function createPasswordResetToken(
  prisma: PasswordResetPrismaClient,
  email: string,
  now: number = Date.now()
): Promise<{ accountId: string; token: string } | null> {
  const account = await prisma.account.findUnique({ where: { email } });
  if (!account) return null;

  await prisma.passwordResetToken.deleteMany({
    where: { accountId: account.id, expiresAt: { lt: new Date(now - RESET_TOKEN_RETENTION_MS) } },
  });

  const recentRequests = await prisma.passwordResetToken.count({
    where: { accountId: account.id, createdAt: { gte: new Date(now - RESET_REQUEST_WINDOW_MS) } },
  });
  if (recentRequests >= RESET_REQUEST_LIMIT) return null;

  await prisma.passwordResetToken.updateMany({
    where: { accountId: account.id, usedAt: null },
    data: { usedAt: new Date(now) },
  });

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), accountId: account.id, expiresAt: new Date(now + RESET_TOKEN_TTL_MS) },
  });

  return { accountId: account.id, token };
}

/**
 * Validates a raw token from a reset link (exists, unused, unexpired) and, if valid, marks
 * it used and stores the new password in a single transaction.
 *
 * Both writes commit together or neither does. Doing them separately meant a failure while
 * saving the password still burned the user's only link, leaving them locked out with a
 * dead link and an unchanged password.
 *
 * Bumps `sessionVersion` for the same reason updatePassword does: a reset exists to lock
 * somebody out, so it must revoke sessions that predate it.
 *
 * Returns false uniformly for "doesn't exist" / "already used" / "expired": callers must
 * not distinguish them in user-facing copy (same reasoning as session.ts's
 * verifySessionCookieValue).
 */
export async function resetPasswordWithToken(
  prisma: PasswordResetPrismaClient,
  rawToken: string,
  newPassword: string,
  now: number = Date.now()
): Promise<boolean> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!record || record.usedAt || record.expiresAt.getTime() < now) return false;

  // Hashed before the transaction opens: bcrypt at cost 12 takes hundreds of milliseconds,
  // which is far too long to hold a database transaction open for.
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date(now) } });
    await tx.account.update({
      where: { id: record.accountId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
  });

  return true;
}
