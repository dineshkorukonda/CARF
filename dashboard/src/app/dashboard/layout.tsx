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
      <a href="#dashboard-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <SidebarShell installations={installations} accountEmail={account.email} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
        <Topbar accountEmail={account.email} installations={installations} />
        <main id="dashboard-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
