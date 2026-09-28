import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { signGithubAppJwt } from "../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../adapters/github/installationTokenClient";
import { listInstallationRepos, type InstallationRepo } from "../../adapters/github/reposClient";
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

  // Fetch repo connections, rollouts, and commits
  const installationIds = installations.map((i) => String(i.installationId));

  const [connections, rollouts, commits] = await Promise.all([
    prisma.repoConnection.findMany({
      where: {
        installationId: { in: installationIds },
      },
    }),
    prisma.rolloutOutcome.findMany({
      where: {
        installationId: { in: installationIds },
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 200,
    }),
    prisma.commit.findMany({
      where: {
        installationId: { in: installationIds },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    }),
  ]);

  return (
    <RepoListView
      repos={repos.map((r) => ({
        ...r,
        owner: r.owner.login,
        private: Boolean(r.private),
      }))}
      connections={connections}
      rollouts={rollouts}
      commits={commits}
    />
  );
}
