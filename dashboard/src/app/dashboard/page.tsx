import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { signGithubAppJwt } from "../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../adapters/github/installationTokenClient";
import { listInstallationRepos, type InstallationRepo } from "../../adapters/github/reposClient";
import { readOrEmpty } from "../../lib/repoActivity";
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

  const activity = await readOrEmpty(
    "[dashboard/page] failed to load rollout activity:",
    () =>
      Promise.all([
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
      ]),
    [[], [], []] as const,
  );
  const [connections, rollouts, commits] = activity.value;

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
      activityError={activity.error}
    />
  );
}
