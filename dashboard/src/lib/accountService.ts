import type { GithubOAuthUser } from "../adapters/github/oauthClient";
import type { GithubInstallation } from "../adapters/github/appInstallClient";

export interface AccountRow {
  id: string;
  githubUserId: string;
  githubLogin: string;
  avatarUrl: string | null;
}

export interface InstallationRow {
  id: string;
  installationId: string;
  accountId: string;
  targetLogin: string;
  targetType: string;
  repositorySelection: string;
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
    upsert(args: {
      where: { githubUserId: string };
      create: { githubUserId: string; githubLogin: string; avatarUrl: string | null };
      update: { githubLogin: string; avatarUrl: string | null };
    }): Promise<AccountRow>;
  };
  installation: {
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
  };
}

/** Upserts by GitHub's numeric user id (stable across logins) on every sign-in. */
export async function upsertAccountFromGithubUser(
  prisma: DashboardPrismaClient,
  user: GithubOAuthUser
): Promise<AccountRow> {
  return prisma.account.upsert({
    where: { githubUserId: String(user.id) },
    create: { githubUserId: String(user.id), githubLogin: user.login, avatarUrl: user.avatar_url },
    update: { githubLogin: user.login, avatarUrl: user.avatar_url },
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

export async function listInstallationsForAccount(
  prisma: DashboardPrismaClient,
  accountId: string
): Promise<InstallationRow[]> {
  return prisma.installation.findMany({ where: { accountId }, orderBy: { createdAt: "desc" } });
}
