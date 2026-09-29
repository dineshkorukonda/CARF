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
import { SetupWizard } from "./SetupWizard";

export default async function SetupPage(props: {
  searchParams?: Promise<{ repo?: string; edit?: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const searchParams = props.searchParams ? await props.searchParams : {};
  const initialRepoFullName = typeof searchParams.repo === "string" ? searchParams.repo : "";
  const forceEdit = searchParams.edit === "1";

  const installations = await listInstallationsForAccount(prisma, account.id);
  if (installations.length === 0) {
    redirect("/dashboard/settings");
  }

  // Fetch repos for first installation by default
  const primary = installations[0]!;
  let repos: InstallationRepo[] = [];
  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const { token } = await createInstallationToken(primary.installationId, appJwt);
    repos = await listInstallationRepos(token);
  } catch (err) {
    console.error("[dashboard/setup] failed to load repos:", err);
  }

  // Fetch RepoConnection rows for this account's installations
  const connections = await prisma.repoConnection.findMany({
    where: {
      installationId: {
        in: installations.map((i) => String(i.installationId)),
      },
    },
  });

  // Already linked: don't send the user through onboarding again.
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
    />
  );
}
