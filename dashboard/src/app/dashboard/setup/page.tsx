import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../lib/auth";
import { listInstallationsForAccount, type InstallationRow } from "../../../lib/accountService";
import { prisma } from "../../../lib/prisma";
import { env } from "../../../config/env";
import { signGithubAppJwt } from "../../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../../adapters/github/installationTokenClient";
import { listInstallationRepos, type InstallationRepo } from "../../../adapters/github/reposClient";
import { findRepoConnection, splitRepoFullName } from "../../../lib/connectionLookup";
import { projectPageHref } from "../../../lib/dashboardNav";
import { listRepoConnectionsSafe } from "../../../lib/repoConnectionService";
import { SetupWizard, type RepoConnectionItem } from "./SetupWizard";

export default async function SetupPage(props: {
  searchParams?: Promise<{ repo?: string; edit?: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const searchParams = props.searchParams ? await props.searchParams : {};
  const initialRepoFullName = typeof searchParams.repo === "string" ? searchParams.repo : "";
  const forceEdit = searchParams.edit === "1";

  let installations: InstallationRow[] = [];
  try {
    installations = await listInstallationsForAccount(prisma, account.id);
  } catch (err) {
    console.error("[dashboard/setup] failed to load installations:", err);
  }

  // Fetch repos from the GitHub App installation if present
  const githubInstallation = installations.find((i) => !String(i?.installationId || "").startsWith("host_"));
  let repos: InstallationRepo[] = [];
  if (githubInstallation) {
    try {
      const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
      const { token } = await createInstallationToken(githubInstallation.installationId, appJwt);
      repos = await listInstallationRepos(token);
    } catch (err) {
      console.error("[dashboard/setup] failed to load repos:", err);
    }
  }

  // Fetch RepoConnection rows for this account's installations (safe against missing columns / unapplied migrations)
  let connections: RepoConnectionItem[] = [];
  if (installations.length > 0) {
    try {
      connections = (await listRepoConnectionsSafe(
        installations.map((i) => String(i.installationId)),
      )) as unknown as RepoConnectionItem[];
    } catch (err) {
      console.error("[dashboard/setup] failed to load repo connections:", err);
    }
  }

  // Already linked: don't send the user through onboarding again if they specifically requested an already configured repo
  if (initialRepoFullName && !forceEdit) {
    const existing = findRepoConnection(connections, initialRepoFullName);
    const parts = splitRepoFullName(initialRepoFullName);
    if (existing && parts) {
      redirect(projectPageHref(parts.owner, parts.repo));
    }
  }

  return (
    <SetupWizard
      installations={installations}
      initialRepos={repos}
      connections={connections}
      initialRepoFullName={initialRepoFullName}
      accountName={account.name || account.email?.split("@")[0] || "server"}
    />
  );
}
