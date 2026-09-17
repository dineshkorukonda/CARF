import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { fetchRecentCommits, type RecentCommit } from "../../../../adapters/coreApi/client";
import { env } from "../../../../config/env";
import { mintInstallationToken } from "../../../../lib/installationAccess";
import { listInstallationRepos, type InstallationRepo } from "../../../../adapters/github/reposClient";
import { StatusTable } from "./StatusTable";
import { RepoNavigationTabs } from "../../RepoNavigationTabs";

export default async function StatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ installationId: string }>;
  searchParams?: Promise<{ repo?: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const { installationId } = await params;
  const { repo: initialRepo } = (await searchParams) ?? {};

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) redirect("/dashboard?error=not_authorized");

  let commits: RecentCommit[] = [];
  let repos: InstallationRepo[] = [];
  let loadError: string | null = null;
  let apiKey: string | null = null;

  try {
    apiKey = await ensureCoreApiKey(prisma, installation);
    commits = await fetchRecentCommits(env.coreApiBaseUrl(), apiKey);
  } catch (err) {
    console.error("[status] failed to reach core-api for installation", installationId, err);
    loadError = "Couldn't reach core-api for this installation's status yet.";
  }

  try {
    const token = await mintInstallationToken(installationId);
    repos = await listInstallationRepos(token);
  } catch {
    // Non-fatal, StatusTable will derive from commits if needed
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <RepoNavigationTabs
        installationId={installationId}
        repoName={installation.targetLogin}
        apiKey={apiKey}
      />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Live Rollout Status</h1>
        <p className="text-sm text-slate-500">
          Track classified commits, dynamic error budgets, and active watchdogs by project.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{loadError}</p>
      ) : (
        <StatusTable
          installationId={installationId}
          initial={commits}
          repos={repos}
          initialRepoFilter={initialRepo}
        />
      )}
    </main>
  );
}
