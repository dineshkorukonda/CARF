import bcrypt from "bcryptjs";
import type { GithubInstallation } from "../adapters/github/appInstallClient";

const BCRYPT_SALT_ROUNDS = 12;

/** Single place the cost factor is applied, so every path that stores a password -- signup,
 *  the account settings form, and a "forgot password" reset -- hashes it identically. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export interface AccountRow {
  id: string;
  email: string;
  passwordHash: string;
  /** Incremented on every password change; signed into the session cookie so that a
   *  password change revokes sessions minted before it. See lib/session.ts. */
  sessionVersion: number;
  createdAt: Date;
}

export interface InstallationRow {
  id: string;
  installationId: string;
  accountId: string;
  targetLogin: string;
  targetType: string;
  repositorySelection: string;
  coreApiKey: string | null;
  createdAt: Date;
}

/**
 * Structural subset of the generated Prisma client this service depends on -- same
 * interface-injection pattern as core-api's PipelinePrismaClient (see
 * core-api/src/pipeline.ts): tests supply an in-memory fake, production code passes the
 * real `@prisma/client` singleton, which satisfies this shape without any adapter code.
 */
export interface DashboardPrismaClient {
  account: {
    create(args: { data: { email: string; passwordHash: string } }): Promise<AccountRow>;
    findUnique(args: { where: { email: string } }): Promise<AccountRow | null>;
    update(args: {
      where: { id: string };
      data: { passwordHash: string; sessionVersion: { increment: number } };
    }): Promise<AccountRow>;
  };
  installation: {
    findFirst(args: { where: { accountId: string; installationId: string } }): Promise<InstallationRow | null>;
    upsert(args: {
      where: { installationId: string };
      create: {
        installationId: string;
        accountId: string;
        targetLogin: string;
        targetType: string;
        repositorySelection: string;
      };
      update: { targetLogin: string; targetType: string; repositorySelection: string };
    }): Promise<InstallationRow>;
    findMany(args: { where: { accountId: string }; orderBy: { createdAt: "desc" } }): Promise<InstallationRow[]>;
    update(args: { where: { installationId: string }; data: { coreApiKey: string } }): Promise<InstallationRow>;
  };
}

export class EmailAlreadyRegisteredError extends Error {
  constructor(email: string) {
    super(`An account already exists for ${email}`);
    this.name = "EmailAlreadyRegisteredError";
  }
}

/** Creates a new Account with a bcrypt-hashed password. Checked (not relying on a DB
 *  unique-constraint error) so the fake Prisma client in tests behaves identically to the
 *  real one. */
export async function createAccount(
  prisma: DashboardPrismaClient,
  email: string,
  password: string
): Promise<AccountRow> {
  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) throw new EmailAlreadyRegisteredError(email);

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  return prisma.account.create({ data: { email, passwordHash } });
}

/** Looks up an Account by email and verifies the password against its stored hash. Returns
 *  null on either a missing account or a wrong password -- callers must not distinguish the
 *  two in user-facing error messages (avoids leaking which emails are registered). */
export async function verifyCredentials(
  prisma: DashboardPrismaClient,
  email: string,
  password: string
): Promise<AccountRow | null> {
  const account = await prisma.account.findUnique({ where: { email } });
  if (!account) return null;

  const valid = await bcrypt.compare(password, account.passwordHash);
  return valid ? account : null;
}

/** Re-hashes and stores a new password for an already-authenticated account (the Account
 *  settings page's change-password form) -- no current-password check, since the caller
 *  already has a valid session cookie proving recent authentication.
 *
 *  Bumps `sessionVersion` in the same update, which revokes every session cookie minted
 *  before this change. That is the point of changing a password after a compromise: the
 *  new hash alone would leave a stolen cookie working for the rest of SESSION_TTL_MS. */
export async function updatePassword(prisma: DashboardPrismaClient, accountId: string, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  await prisma.account.update({
    where: { id: accountId },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });
}

/**
 * Links a freshly-installed GitHub App installation to the logged-in account. Upsert (not
 * create) because GitHub's install callback can redeliver on retries/setup_action=update,
 * and because the account attached to an installationId shouldn't accidentally fork into
 * two rows across separate install attempts.
 */
export async function linkInstallation(
  prisma: DashboardPrismaClient,
  accountId: string,
  installation: GithubInstallation
): Promise<InstallationRow> {
  const targetLogin = installation.account?.login ?? "unknown";
  const targetType = installation.account?.type ?? "unknown";
  return prisma.installation.upsert({
    where: { installationId: String(installation.id) },
    create: {
      installationId: String(installation.id),
      accountId,
      targetLogin,
      targetType,
      repositorySelection: installation.repository_selection,
    },
    update: { targetLogin, targetType, repositorySelection: installation.repository_selection },
  });
}

/**
 * Ownership check for the config UI (#62/#63): confirms the logged-in account actually
 * has this installationId linked before minting an installation token / touching a repo's
 * `.carf.yml` on its behalf -- an installationId in a URL is guessable, this isn't a
 * capability token.
 */
export async function getInstallationForAccount(
  prisma: DashboardPrismaClient,
  accountId: string,
  installationId: string
): Promise<InstallationRow | null> {
  return prisma.installation.findFirst({ where: { accountId, installationId } });
}

export async function listInstallationsForAccount(
  prisma: DashboardPrismaClient,
  accountId: string
): Promise<InstallationRow[]> {
  return prisma.installation.findMany({ where: { accountId }, orderBy: { createdAt: "desc" } });
}

/** Caches core-api's per-installation API key once fetched (#64) so it isn't re-minted on
 *  every status-view load -- see prisma/schema.prisma's `coreApiKey` doc comment. */
export async function saveCoreApiKey(
  prisma: DashboardPrismaClient,
  installationId: string,
  coreApiKey: string
): Promise<void> {
  await prisma.installation.update({ where: { installationId }, data: { coreApiKey } });
}
