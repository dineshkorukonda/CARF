import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { signGithubAppJwt } from "../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../adapters/github/installationTokenClient";
import { listInstallationRepos, type InstallationRepo } from "../../adapters/github/reposClient";
import { listIntegratedRepos, readOrEmpty } from "../../lib/repoActivity";
import {
  listRepoConnectionsSafe,
  attemptAutoRepairSchema,
} from "../../lib/repoConnectionService";
import { RepoListView } from "./RepoListView";

export default async function DashboardPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const installations = await listInstallationsForAccount(prisma, account.id);
  if (installations.length === 0) {
    redirect("/dashboard/settings");
  }

  const primary = installations[0]!;

  // Fetch repositories granted to this integration
  let repos: InstallationRepo[] = [];
  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const { token } = await createInstallationToken(primary.installationId, appJwt);
    repos = await listInstallationRepos(token);
  } catch (err) {
    console.error("[dashboard/page] failed to load repos:", err);
  }

  const installationIds = installations.map((i) => String(i.installationId));

  // Run non-destructive schema auto-repair so missing columns on Neon are fixed
  void attemptAutoRepairSchema();

  // Safely load all user's repo connections with fallback to raw SQL query
  // so connected repositories NEVER disappear due to pending schema migrations
  const connections = await listRepoConnectionsSafe(installationIds);

  // Fetch rollouts and commits independently so a rollout/commit schema mismatch
  // never blanks out the repository list
  const [rolloutsRes, commitsRes] = await Promise.all([
    readOrEmpty(
      "[dashboard/page] failed to load rollouts:",
      () =>
        prisma.rolloutOutcome.findMany({
          where: {
            installationId: { in: installationIds },
          },
          orderBy: {
            startedAt: "desc",
          },
          take: 200,
        }),
      [],
    ),
    readOrEmpty(
      "[dashboard/page] failed to load commits:",
      () =>
        prisma.commit.findMany({
          where: {
            installationId: { in: installationIds },
          },
          include: {
            changeVector: true,
            threshold: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 200,
        }),
      [],
    ),
  ]);

  const rollouts = rolloutsRes.value;
  const commits = commitsRes.value;
  const activityError = rolloutsRes.error || commitsRes.error;

  const githubRepos = repos.map((r) => ({
    ...r,
    owner: r.owner.login,
    private: Boolean(r.private),
  }));

  return (
    <RepoListView
      repos={listIntegratedRepos(githubRepos, connections)}
      connections={connections}
      rollouts={rollouts}
      commits={commits}
      activityError={activityError}
    />
  );
}
