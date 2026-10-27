import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";
import { SidebarShell } from "./SidebarShell";
import { Topbar } from "./Topbar";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const installations = await listInstallationsForAccount(prisma, account.id, { prune: false });

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden">
      <SidebarShell installations={installations} accountEmail={account.email} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
        <Topbar accountEmail={account.email} installations={installations} />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}
