"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Boxes, ChevronsLeft, ChevronsRight, House, LogOut, Radio, Settings2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { InstallationRow } from "../../lib/accountService";

const COLLAPSE_STORAGE_KEY = "carf.sidebar.collapsed";

function NavLink({
  href,
  exact,
  icon,
  collapsed,
  children,
}: {
  href: string;
  exact?: boolean;
  icon: React.ReactNode;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      title={collapsed ? String(children) : undefined}
      className={
        "flex items-center gap-2.5 rounded-md px-3 py-1.5 font-mono text-xs tracking-wide uppercase transition-colors " +
        (active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")
      }
    >
      {icon}
      {!collapsed && <span className="truncate">{children}</span>}
    </Link>
  );
}

function SubNavLink({
  href,
  icon,
  collapsed,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      title={collapsed ? String(children) : undefined}
      className={
        "flex items-center gap-2 rounded-md px-3 py-1 font-mono text-[11px] tracking-wide uppercase transition-colors " +
        (active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")
      }
    >
      {icon}
      {!collapsed && <span className="truncate">{children}</span>}
    </Link>
  );
}

export function SidebarShell({
  installations,
  accountEmail,
}: {
  installations: InstallationRow[];
  accountEmail: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
      // One-time sync from localStorage (an external store, unreadable during SSR) into
      // state right after mount -- not the "derive state from props" anti-pattern the
      // set-state-in-effect rule targets.
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsed(true);
      }
    } catch {
      // localStorage unavailable (private browsing, etc.) -- default expanded is fine.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Non-fatal -- collapse state just won't persist across reloads.
      }
      return next;
    });
  }

  return (
    <aside
      className={
        "flex shrink-0 flex-col justify-between bg-card text-card-foreground transition-[width] duration-150 " +
        (collapsed ? "w-16" : "w-60")
      }
    >
      <div className="flex flex-col gap-6 px-3 py-5">
        <div className={collapsed ? "flex flex-col items-center gap-3" : "flex items-center justify-between px-1"}>
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium tracking-tight">
            {collapsed ? (
              <span className="flex size-6 items-center justify-center rounded-md bg-white font-mono text-[11px] font-bold text-background">
                C
              </span>
            ) : (
              <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-background">
                CARF
              </span>
            )}
            {!collapsed && <span>Dashboard</span>}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </div>

        <nav className="flex flex-col gap-0.5">
          <NavLink href="/dashboard" exact collapsed={collapsed} icon={<House className="size-4 shrink-0" />}>
            Home
          </NavLink>
          <NavLink
            href="/dashboard/installations"
            collapsed={collapsed}
            icon={<Boxes className="size-4 shrink-0" />}
          >
            Installations
          </NavLink>
        </nav>

        <div className="flex flex-col gap-0.5">
          {!collapsed && (
            <p className="px-3 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Your repos
            </p>
          )}
          {installations.length === 0 && !collapsed && (
            <p className="px-3 py-1.5 text-sm text-muted-foreground">None yet</p>
          )}
          {installations.map((installation) => (
            <div key={installation.id} className="flex flex-col">
              <div
                className="flex items-center gap-2 px-3 py-1.5"
                title={collapsed ? installation.targetLogin : undefined}
              >
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
                {!collapsed && <span className="truncate text-sm">{installation.targetLogin}</span>}
              </div>
              <div className={collapsed ? "flex flex-col" : "ml-6 flex flex-col"}>
                <SubNavLink
                  href={`/dashboard/status/${installation.installationId}`}
                  collapsed={collapsed}
                  icon={<Radio className="size-3.5 shrink-0" />}
                >
                  Status
                </SubNavLink>
                <SubNavLink
                  href={`/dashboard/config/${installation.installationId}`}
                  collapsed={collapsed}
                  icon={<Settings2 className="size-3.5 shrink-0" />}
                >
                  Configure
                </SubNavLink>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-3 py-4">
        {!collapsed && <p className="truncate px-1 text-xs text-muted-foreground">{accountEmail}</p>}
        <form action="/api/auth/logout" method="POST">
          <Button
            variant="outline"
            size="sm"
            type="submit"
            title={collapsed ? "Sign out" : undefined}
            className="w-full justify-center gap-2 bg-transparent hover:bg-white/10"
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && "Sign out"}
          </Button>
        </form>
      </div>
    </aside>
  );
}
