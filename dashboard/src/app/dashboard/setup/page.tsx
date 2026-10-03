import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../lib/auth";
import { listInstallationsForAccount } from "../../../lib/accountService";
import { prisma } from "../../../lib/prisma";
import { env } from "../../../config/env";
import { signGithubAppJwt } from "../../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../../adapters/github/installationTokenClient";
import { listInstallationRepos, type InstallationRepo } from "../../../adapters/github/reposClient";
import { findRepoConnection, splitRepoFullName } from "../../../lib/connectionLookup";
import { projectPageHref } from "../../../lib/dashboardNav";
import { activityErrorMessage } from "../../../lib/repoActivity";
import { loadRepoConnections } from "../../../lib/loadRepoConnections";
import { SetupWizard } from "./SetupWizard";

export default async function SetupPage(props: {
  searchParams?: Promise<{ repo?: string; edit?: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const searchParams = props.searchParams ? await props.searchParams : {};
  const initialRepoFullName = typeof searchParams.repo === "string" ? searchParams.repo : "";
  const forceEdit = searchParams.edit === "1";

  let installations: Awaited<ReturnType<typeof listInstallationsForAccount>> = [];
  let installationsError: string | null = null;
  try {
    installations = await listInstallationsForAccount(prisma, account.id);
  } catch (err) {
    console.error("[dashboard/setup] failed to load installations:", err);
    installationsError = activityErrorMessage(err);
  }

  const githubInstallation = installations.find((i) => !i.installationId.startsWith("host_"));
  let repos: InstallationRepo[] = [];
  let reposError: string | null = null;
  if (githubInstallation) {
    try {
      const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
      const { token } = await createInstallationToken(githubInstallation.installationId, appJwt);
      repos = await listInstallationRepos(token);
    } catch (err) {
      console.error("[dashboard/setup] failed to load repos:", err);
      reposError = "GitHub repositories could not be loaded. Confirm the GitHub App installation and retry.";
    }
  }

  const connectionRead = await loadRepoConnections(
    prisma,
    installations.map((i) => String(i.installationId))
  );
  const connections = connectionRead.value;

  if (initialRepoFullName && !forceEdit) {
    const existing = findRepoConnection(connections, initialRepoFullName);
    const parts = splitRepoFullName(initialRepoFullName);
    if (existing && parts) {
      redirect(projectPageHref(parts.owner, parts.repo));
    }
  }

  return (
    <SetupWizard
      installations={installations.map((installation) => ({
        id: installation.id,
        installationId: installation.installationId,
        targetLogin: installation.targetLogin,
        targetType: installation.targetType,
      }))}
      initialRepos={repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: { login: repo.owner.login },
        default_branch: repo.default_branch,
        private: Boolean(repo.private),
      }))}
      connections={connections}
      initialRepoFullName={initialRepoFullName}
      accountName={account.name || account.email?.split("@")[0] || "server"}
      loadError={installationsError || connectionRead.error || reposError}
    />
  );
}
