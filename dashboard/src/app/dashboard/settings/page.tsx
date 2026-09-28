import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../lib/auth";
import { listInstallationsForAccount } from "../../../lib/accountService";
import { prisma } from "../../../lib/prisma";
import { SettingsTabsView } from "./SettingsTabsView";

export default async function SettingsPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const installations = await listInstallationsForAccount(prisma, account.id);

  return (
    <SettingsTabsView
      account={account}
      installations={installations}
    />
  );
}
