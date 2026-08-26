import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";
import { SidebarShell } from "./SidebarShell";
import { Topbar } from "./Topbar";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const installations = await listInstallationsForAccount(prisma, account.id);

  return (
    <div className="flex min-h-screen">
      <SidebarShell installations={installations} accountEmail={account.email} />
      <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
        <Topbar accountEmail={account.email} installations={installations} />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
