import type { GithubInstallation } from "../adapters/github/appInstallClient";

export interface AccountRow {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  githubId?: string | null;
  createdAt: Date;
}

export interface InstallationRow {
  id: string;
  installationId: string;
  userId: string;
  /** Backward compatibility alias for UI components referencing accountId */
  accountId?: string;
  targetLogin: string;
  targetType: string;
  repositorySelection: string;
  coreApiKey: string | null;
  createdAt: Date;
}

export interface DashboardPrismaClient {
  installation: {
    findUnique?(args: { where: { installationId: string } }): Promise<InstallationRow | null>;
    findFirst(args: { where: { userId?: string; accountId?: string; installationId: string } }): Promise<InstallationRow | null>;
    upsert(args: {
      where: { installationId: string };
      create: {
        installationId: string;
        userId: string;
        targetLogin: string;
        targetType: string;
        repositorySelection: string;
      };
      update: { targetLogin: string; targetType: string; repositorySelection: string };
    }): Promise<InstallationRow>;
    findMany(args: { where: { userId?: string; accountId?: string }; orderBy: { createdAt: "desc" } }): Promise<InstallationRow[]>;
    update(args: { where: { installationId: string }; data: { coreApiKey: string } }): Promise<InstallationRow>;
  };
}

export class InstallationAlreadyLinkedError extends Error {
  constructor(installationId: string) {
    super(`Installation ${installationId} is already linked to another account`);
    this.name = "InstallationAlreadyLinkedError";
  }
}

/**
 * Links a freshly-installed GitHub App installation to the logged-in user. Upsert (not
 * create) because GitHub's install callback can redeliver on retries/setup_action=update.
 *
 * Rejects if the installation is already claimed by a different user.
 */
export async function linkInstallation(
  prisma: DashboardPrismaClient,
  userId: string,
  installation: GithubInstallation
): Promise<InstallationRow> {
  const targetLogin = installation.account?.login ?? "unknown";
  const targetType = installation.account?.type ?? "unknown";
  const existing = prisma.installation.findUnique
    ? await prisma.installation.findUnique({ where: { installationId: String(installation.id) } })
    : null;
  if (existing && existing.userId && existing.userId !== userId) {
    throw new InstallationAlreadyLinkedError(String(installation.id));
  }
  return prisma.installation.upsert({
    where: { installationId: String(installation.id) },
    create: {
      installationId: String(installation.id),
      userId,
      targetLogin,
      targetType,
      repositorySelection: installation.repository_selection,
    },
    update: { targetLogin, targetType, repositorySelection: installation.repository_selection },
  });
}

/**
 * Ownership check for the config UI: confirms the logged-in user actually has this
 * installationId linked before minting an installation token.
 */
export async function getInstallationForAccount(
  prisma: DashboardPrismaClient,
  userId: string,
  installationId: string
): Promise<InstallationRow | null> {
  return prisma.installation.findFirst({ where: { userId, installationId } });
}

export async function listInstallationsForAccount(
  prisma: DashboardPrismaClient,
  userId: string
): Promise<InstallationRow[]> {
  return prisma.installation.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

/** Caches core-api's per-installation API key once fetched. */
export async function saveCoreApiKey(
  prisma: DashboardPrismaClient,
  installationId: string,
  coreApiKey: string
): Promise<void> {
  await prisma.installation.update({ where: { installationId }, data: { coreApiKey } });
}
