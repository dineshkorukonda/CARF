import { redirect } from "next/navigation";
import { InstallationTabs } from "../../../../components/InstallationTabs";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { fetchRecentCommits, type RecentCommit } from "../../../../adapters/coreApi/client";
import { env } from "../../../../config/env";
import { StatusTable } from "./StatusTable";

export default async function StatusPage({ params }: { params: Promise<{ installationId: string }> }) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const { installationId } = await params;
  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) redirect("/dashboard?error=not_authorized");

  let commits: RecentCommit[] = [];
  let loadError: string | null = null;
  try {
    const apiKey = await ensureCoreApiKey(prisma, installation);
    commits = await fetchRecentCommits(env.coreApiBaseUrl(), apiKey);
  } catch {
    loadError = "Couldn't reach core-api for this installation's status yet.";
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">{installation.targetLogin}</h1>
        <p className="text-sm text-muted-foreground">Recent classified commits.</p>
      </div>

      <InstallationTabs installationId={installationId} active="status" />

      {loadError ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{loadError}</p>
      ) : (
        <StatusTable installationId={installationId} initial={commits} />
      )}
    </main>
  );
}
