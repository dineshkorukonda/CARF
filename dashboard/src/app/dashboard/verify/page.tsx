import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../lib/auth";
import { listInstallationsForAccount } from "../../../lib/accountService";
import { prisma } from "../../../lib/prisma";
import { VerifyDashboard } from "./VerifyDashboard";
import { getEvaluationHistory } from "../../../lib/evalHarness";

export default async function VerifyRootPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const installations = await listInstallationsForAccount(prisma, account.id);
  if (installations.length === 0) {
    redirect("/dashboard/settings");
  }

  const primary = installations[0]!;
  const history = await getEvaluationHistory(10);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
        Internal research route. This page is not part of the product sidebar and uses synthetic data.
      </p>
      <VerifyDashboard
        installationId={primary.installationId}
        repoName={primary.targetLogin || `Installation #${primary.installationId}`}
        initialHistory={history}
      />
    </main>
  );
}
