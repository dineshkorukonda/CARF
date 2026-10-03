import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { signGithubAppJwt } from "../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../adapters/github/installationTokenClient";
import { listInstallationRepos, type InstallationRepo } from "../../adapters/github/reposClient";
import { listIntegratedRepos, readOrEmpty } from "../../lib/repoActivity";
import { loadRepoConnections } from "../../lib/loadRepoConnections";
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

  // Fetch repo connections, rollouts, and commits. A missing column here is a
  // server migration gap (RolloutOutcome.trigger / readyAt), not a reason to
  // blank the whole repositories page.
  const installationIds = installations.map((i) => String(i.installationId));

  const connectionRead = await loadRepoConnections(prisma, installationIds);
  const activity = await readOrEmpty(
    "[dashboard/page] failed to load rollout activity:",
    () =>
      Promise.all([
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
      ]),
    [[], []] as const,
  );
  const [rollouts, commits] = activity.value;
  const connections = connectionRead.value;

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
      activityError={connectionRead.error || activity.error}
    />
  );
}
