import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { mintInstallationToken } from "../../../../lib/installationAccess";
import { listInstallationRepos, type InstallationRepo } from "../../../../adapters/github/reposClient";
import { IntegrationsView } from "./IntegrationsView";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ installationId: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const { installationId } = await params;

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) redirect("/dashboard?error=not_authorized");

  let apiKey: string | null = null;
  let repos: InstallationRepo[] = [];

  try {
    apiKey = await ensureCoreApiKey(prisma, installation);
  } catch (err) {
    console.error("[integrations] failed to reach core-api for installation key", installationId, err);
  }

  try {
    const token = await mintInstallationToken(installationId);
    repos = await listInstallationRepos(token);
  } catch {
    // Non-fatal
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <IntegrationsView
        installationId={installationId}
        targetLogin={installation.targetLogin}
        apiKey={apiKey}
        repos={repos}
      />
    </main>
  );
}
