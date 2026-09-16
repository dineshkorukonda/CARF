import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../lib/auth";
import { listInstallationsForAccount } from "../../../lib/accountService";
import { prisma } from "../../../lib/prisma";
import { TestingPlaybookView } from "./TestingPlaybookView";

export default async function TestingPlaybookPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const installations = await listInstallationsForAccount(prisma, account.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 md:p-8">
      <TestingPlaybookView
        installations={installations}
        accountEmail={account.email}
      />
    </main>
  );
}
