"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { InstallationRow } from "../../lib/accountService";

function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={
        "rounded-md px-3 py-1.5 text-sm transition-colors " +
        (active ? "bg-white/10 text-white" : "text-[#a7adba] hover:bg-white/5 hover:text-white")
      }
    >
      {children}
    </Link>
  );
}

function SubNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={
        "rounded-md px-3 py-1 text-xs transition-colors " +
        (active ? "bg-white/10 text-white" : "text-[#a7adba] hover:bg-white/5 hover:text-white")
      }
    >
      {children}
    </Link>
  );
}

export function SidebarNav({ installations }: { installations: InstallationRow[] }) {
  return (
    <>
      <nav className="flex flex-col gap-0.5">
        <NavLink href="/dashboard" exact>
          Overview
        </NavLink>
      </nav>

      <div className="flex flex-col gap-0.5">
        <p className="px-3 text-[11px] font-medium tracking-wide text-[#5c6270] uppercase">Installations</p>
        {installations.length === 0 && <p className="px-3 py-1.5 text-sm text-[#5c6270]">None yet</p>}
        {installations.map((installation) => (
          <div key={installation.id} className="flex flex-col">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
              <span className="truncate text-sm text-[#e3e6ea]">{installation.targetLogin}</span>
            </div>
            <div className="ml-6 flex flex-col">
              <SubNavLink href={`/dashboard/status/${installation.installationId}`}>Status</SubNavLink>
              <SubNavLink href={`/dashboard/config/${installation.installationId}`}>Configure</SubNavLink>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
