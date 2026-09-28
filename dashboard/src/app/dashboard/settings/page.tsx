import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../lib/auth";
import { listInstallationsForAccount } from "../../../lib/accountService";
import { prisma } from "../../../lib/prisma";
import { SettingsTabsView } from "./SettingsTabsView";

export default async function SettingsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const searchParams = props.searchParams ? await props.searchParams : {};
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const success = typeof searchParams.success === "string" ? searchParams.success : undefined;

  const installations = await listInstallationsForAccount(prisma, account.id);

  return (
    <SettingsTabsView
      account={account}
      installations={installations}
      bannerError={error}
      bannerSuccess={success}
    />
  );
}
