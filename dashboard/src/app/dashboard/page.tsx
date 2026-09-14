import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { signGithubAppJwt } from "../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../adapters/github/installationTokenClient";
import { listInstallationRepos, type InstallationRepo } from "../../adapters/github/reposClient";
import { ensureCoreApiKey } from "../../lib/coreApiAccess";
import { fetchRecentCommits, type RecentCommit } from "../../adapters/coreApi/client";
import { OverviewView } from "./OverviewView";

export default async function DashboardPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const installations = await listInstallationsForAccount(prisma, account.id);
  if (installations.length === 0) {
    redirect("/dashboard/onboarding");
  }

  const primary = installations[0]!;

  // Fetch repositories granted to this integration
  let repos: InstallationRepo[] = [];
  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const { token } = await createInstallationToken(primary.installationId, appJwt);
    repos = await listInstallationRepos(token);
  } catch (err) {
    console.error("[dashboard/overview] failed to load repos:", err);
  }

  // Fetch recent commits from core-api
  let commits: RecentCommit[] = [];
  try {
    const apiKey = await ensureCoreApiKey(prisma, primary);
    commits = await fetchRecentCommits(env.coreApiBaseUrl(), apiKey);
  } catch (err) {
    console.error("[dashboard/overview] failed to load commits:", err);
  }

  return (
    <OverviewView
      installation={primary}
      repos={repos}
      commits={commits}
      accountEmail={account.email}
    />
  );
}
