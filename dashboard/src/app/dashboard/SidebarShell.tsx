"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Boxes, ChevronsLeft, ChevronsRight, House, LogOut, Radio, Settings2, UserRound } from "lucide-react";
import { Button } from "../../components/ui/button";
import { InstallationSwitcher } from "./InstallationSwitcher";
import type { InstallationRow } from "../../lib/accountService";

const COLLAPSE_STORAGE_KEY = "carf.sidebar.collapsed";

function activeInstallationId(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/(?:status|config|analytics)\/([^/]+)/);
  return match ? match[1]! : null;
}

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
        "flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors " +
        (active
          ? "bg-sidebar-foreground text-sidebar"
          : "text-sidebar-foreground/55 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground")
      }
    >
      {icon}
      {!collapsed && <span className="truncate">{children}</span>}
    </Link>
  );
}

function ContextNavLink({
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
        "flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors " +
        (active
          ? "bg-sidebar-foreground/10 text-sidebar-foreground"
          : "text-sidebar-foreground/55 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground")
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
  const pathname = usePathname();
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

  const activeId = activeInstallationId(pathname);
  const active = activeId ? installations.find((i) => i.installationId === activeId) : undefined;

  return (
    <aside
      className={
        "flex shrink-0 flex-col justify-between bg-sidebar text-sidebar-foreground transition-[width] duration-150 " +
        (collapsed ? "w-16" : "w-60")
      }
    >
      <div className="flex flex-col gap-5 py-6">
        <div className={collapsed ? "flex flex-col items-center gap-3 px-3" : "flex items-center justify-between px-4"}>
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold tracking-wide">
            {collapsed ? (
              <span className="flex size-6 items-center justify-center text-[13px] font-bold">C</span>
            ) : (
              <span>CARF</span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-sm p-1.5 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </div>

        {active ? (
          <>
            <InstallationSwitcher installations={installations} active={active} collapsed={collapsed} />
            <nav className="flex flex-col gap-0.5 px-3">
              <ContextNavLink
                href={`/dashboard/status/${active.installationId}`}
                collapsed={collapsed}
                icon={<Radio className="size-4 shrink-0" />}
              >
                Status
              </ContextNavLink>
              <ContextNavLink
                href={`/dashboard/config/${active.installationId}`}
                collapsed={collapsed}
                icon={<Settings2 className="size-4 shrink-0" />}
              >
                Configure
              </ContextNavLink>
              <ContextNavLink
                href={`/dashboard/config/${active.installationId}/rules`}
                collapsed={collapsed}
                icon={<Settings2 className="size-4 shrink-0" />}
              >
                Rules
              </ContextNavLink>
              <ContextNavLink
                href={`/dashboard/analytics/${active.installationId}`}
                collapsed={collapsed}
                icon={<BarChart3 className="size-4 shrink-0" />}
              >
                Analytics
              </ContextNavLink>
            </nav>

            <div className="mx-4 border-t border-sidebar-foreground/10" />

            <nav className="flex flex-col gap-0.5 px-3">
              <NavLink href="/dashboard" exact collapsed={collapsed} icon={<House className="size-4 shrink-0" />}>
                Home
              </NavLink>
              <NavLink href="/dashboard/installations" collapsed={collapsed} icon={<Boxes className="size-4 shrink-0" />}>
                All installations
              </NavLink>
            </nav>
          </>
        ) : (
          <>
            <nav className="flex flex-col gap-0.5 px-3">
              <NavLink href="/dashboard" exact collapsed={collapsed} icon={<House className="size-4 shrink-0" />}>
                Home
              </NavLink>
              <NavLink href="/dashboard/installations" collapsed={collapsed} icon={<Boxes className="size-4 shrink-0" />}>
                All installations
              </NavLink>
            </nav>

            <div className="mx-4 border-t border-sidebar-foreground/10" />

            <div className="flex flex-col gap-1 px-3">
              {!collapsed && (
                <p className="px-3 text-[11px] font-medium tracking-wide text-sidebar-foreground/40 uppercase">
                  Jump to a repo
                </p>
              )}
              {installations.length === 0 && !collapsed && (
                <p className="px-3 py-1.5 text-sm text-sidebar-foreground/45">None yet</p>
              )}
              {installations.map((installation) => (
                <Link
                  key={installation.id}
                  href={`/dashboard/status/${installation.installationId}`}
                  title={collapsed ? installation.targetLogin : undefined}
                  className="flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-[#5b6cff]" />
                  {!collapsed && <span className="truncate">{installation.targetLogin}</span>}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1 border-t border-sidebar-foreground/10 px-3 py-4">
        <NavLink href="/dashboard/account" collapsed={collapsed} icon={<UserRound className="size-4 shrink-0" />}>
          Account
        </NavLink>
        {!collapsed && <p className="truncate px-3 pt-2 text-xs text-sidebar-foreground/45">{accountEmail}</p>}
        <form action="/api/auth/logout" method="POST" className="mt-1">
          <Button
            variant="outline"
            size="sm"
            type="submit"
            title={collapsed ? "Sign out" : undefined}
            className="w-full justify-center gap-2 border-sidebar-foreground/15 bg-transparent text-sidebar-foreground hover:bg-sidebar-foreground/10"
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && "Sign out"}
          </Button>
        </form>
      </div>
    </aside>
  );
}
