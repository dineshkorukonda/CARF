import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";
import { Button } from "../../components/ui/button";
import { SidebarNav } from "./SidebarNav";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const installations = await listInstallationsForAccount(prisma, account.id);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-60 shrink-0 flex-col justify-between bg-[#0b0e14] text-[#e3e6ea]">
        <div className="flex flex-col gap-6 px-4 py-5">
          <Link href="/dashboard" className="flex items-center gap-2 px-1 text-sm font-medium tracking-tight text-white">
            <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-[#0b0e14]">
              CARF
            </span>
            <span>Dashboard</span>
          </Link>

          <SidebarNav installations={installations} />
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4">
          <p className="truncate px-1 text-xs text-[#5c6270]">{account.email}</p>
          <form action="/api/auth/logout" method="POST">
            <Button variant="outline" size="sm" type="submit" className="w-full border-white/15 bg-transparent text-[#e3e6ea] hover:bg-white/10 hover:text-white">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
