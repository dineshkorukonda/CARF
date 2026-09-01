import { createHash, randomBytes } from "node:crypto";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Structural subset of the generated Prisma client this module needs -- same
 * interface-injection pattern as accountService.ts's DashboardPrismaClient, so tests
 * supply an in-memory fake.
 */
export interface PasswordResetPrismaClient {
  account: {
    findUnique(args: { where: { email: string } }): Promise<{ id: string } | null>;
  };
  passwordResetToken: {
    create(args: { data: { tokenHash: string; accountId: string; expiresAt: Date } }): Promise<unknown>;
    findUnique(
      args: { where: { tokenHash: string } }
    ): Promise<{ id: string; accountId: string; expiresAt: Date; usedAt: Date | null } | null>;
    update(args: { where: { id: string }; data: { usedAt: Date } }): Promise<unknown>;
    deleteMany(args: { where: { accountId: string } }): Promise<unknown>;
  };
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Looks up the account by email and, if one exists, issues a fresh single-use reset
 * token (invalidating any earlier ones for that account first, so an old leaked link
 * stops working the moment a new one is requested). Returns null for an unknown email --
 * callers must respond identically either way (a generic "check your inbox" message) to
 * avoid leaking which emails are registered; see api/auth/forgot-password/route.ts.
 */
export async function createPasswordResetToken(
  prisma: PasswordResetPrismaClient,
  email: string,
  now: number = Date.now()
): Promise<{ accountId: string; token: string } | null> {
  const account = await prisma.account.findUnique({ where: { email } });
  if (!account) return null;

  await prisma.passwordResetToken.deleteMany({ where: { accountId: account.id } });

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), accountId: account.id, expiresAt: new Date(now + RESET_TOKEN_TTL_MS) },
  });

  return { accountId: account.id, token };
}

/**
 * Validates a raw token from a reset link (exists, unused, unexpired) and, if valid,
 * immediately marks it used -- closing the replay window between a link being clicked
 * once and the password actually being changed. Returns null uniformly for "doesn't
 * exist" / "already used" / "expired": callers must not distinguish them in user-facing
 * copy (same reasoning as session.ts's verifySessionCookieValue).
 */
export async function redeemPasswordResetToken(
  prisma: PasswordResetPrismaClient,
  rawToken: string,
  now: number = Date.now()
): Promise<{ accountId: string } | null> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!record || record.usedAt || record.expiresAt.getTime() < now) return null;

  await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date(now) } });
  return { accountId: record.accountId };
}
