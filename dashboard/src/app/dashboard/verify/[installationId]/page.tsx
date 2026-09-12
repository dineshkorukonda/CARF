import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { RepoNavigationTabs } from "../../RepoNavigationTabs";
import { VerifyDashboard } from "./VerifyDashboard";
import { getEvaluationHistory } from "../../../../lib/evalHarness";

export default async function VerifyPage({ params }: { params: Promise<{ installationId: string }> }) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const { installationId } = await params;
  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) redirect("/dashboard?error=not_authorized");

  let apiKey: string | null = null;
  try {
    apiKey = await ensureCoreApiKey(prisma, installation);
  } catch {
    // Non-fatal
  }

  const history = await getEvaluationHistory(10);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <RepoNavigationTabs
        installationId={installationId}
        repoName={installation.targetLogin}
        apiKey={apiKey}
      />

      <VerifyDashboard
        installationId={installationId}
        repoName={installation.targetLogin}
        initialHistory={history}
      />
    </main>
  );
}
