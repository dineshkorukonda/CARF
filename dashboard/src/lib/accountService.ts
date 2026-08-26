import bcrypt from "bcryptjs";
import type { GithubInstallation } from "../adapters/github/appInstallClient";

const BCRYPT_SALT_ROUNDS = 12;

export interface AccountRow {
  id: string;
  email: string;
  passwordHash: string;
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
