import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../lib/auth";
import { listInstallationsForAccount } from "../../../lib/accountService";
import { prisma } from "../../../lib/prisma";
import { OnboardingStepper, type OnboardingStatus } from "./OnboardingStepper";

export default async function OnboardingPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const installations = await listInstallationsForAccount(prisma, account.id);
  const primary = installations[0];

  const initialStatus: OnboardingStatus = {
    currentStep: primary ? 3 : 1,
    installationId: primary ? primary.installationId : undefined,
    step1: { completed: installations.length > 0 },
    step2: { completed: installations.length > 0, repoCount: installations.length },
    step3: { completed: false },
    step4: { completed: false },
    step5: { completed: false },
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <OnboardingStepper initial={initialStatus} />
    </main>
  );
}
