"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Boxes, ChevronsLeft, ChevronsRight, House, LogOut, Radio, Settings2, Sliders, UserRound } from "lucide-react";
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
          : "text-sidebar-foreground/60 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground")
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
          ? "bg-sidebar-foreground/15 text-sidebar-foreground font-semibold"
          : "text-sidebar-foreground/60 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground")
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
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsed(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Non-fatal
      }
      return next;
    });
  }

  const activeId = activeInstallationId(pathname);
  // Default to active route param if on repo page, otherwise default to primary installation
  const active = activeId
    ? installations.find((i) => i.installationId === activeId)
    : installations.length > 0
      ? installations[0]
      : undefined;

  return (
    <aside
      className={
        "flex shrink-0 flex-col justify-between bg-sidebar text-sidebar-foreground transition-[width] duration-150 " +
        (collapsed ? "w-16" : "w-60")
      }
    >
      <div className="flex flex-col gap-5 py-6">
        {/* Brand header */}
        <div className={collapsed ? "flex flex-col items-center gap-3 px-3" : "flex items-center justify-between px-4"}>
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold tracking-wide">
            {collapsed ? (
              <span className="flex size-6 items-center justify-center text-[13px] font-bold">C</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>CARF</span>
              </span>
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

        {/* Repository Workspace Nav */}
        {active && (
          <div className="flex flex-col gap-2">
            {!collapsed && (
              <div className="px-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Active Repository
                </p>
              </div>
            )}
            <InstallationSwitcher installations={installations} active={active} collapsed={collapsed} />

            <nav className="flex flex-col gap-0.5 px-3">
              <ContextNavLink
                href={`/dashboard/status/${active.installationId}`}
                collapsed={collapsed}
                icon={<Radio className="size-4 shrink-0 text-emerald-500" />}
              >
                Live Status
              </ContextNavLink>
              <ContextNavLink
                href={`/dashboard/config/${active.installationId}`}
                collapsed={collapsed}
                icon={<Settings2 className="size-4 shrink-0" />}
              >
                Deployment Adapter
              </ContextNavLink>
              <ContextNavLink
                href={`/dashboard/config/${active.installationId}/rules`}
                collapsed={collapsed}
                icon={<Sliders className="size-4 shrink-0" />}
              >
                Threshold Rules
              </ContextNavLink>
              <ContextNavLink
                href={`/dashboard/analytics/${active.installationId}`}
                collapsed={collapsed}
                icon={<BarChart3 className="size-4 shrink-0" />}
              >
                Rollout Analytics
              </ContextNavLink>
            </nav>
          </div>
        )}

        <div className="mx-4 border-t border-sidebar-foreground/10" />

        {/* Global Navigation */}
        <div className="flex flex-col gap-2">
          {!collapsed && (
            <div className="px-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                General
              </p>
            </div>
          )}
          <nav className="flex flex-col gap-0.5 px-3">
            <NavLink href="/dashboard" exact collapsed={collapsed} icon={<House className="size-4 shrink-0" />}>
              Overview
            </NavLink>
            <NavLink href="/dashboard/installations" collapsed={collapsed} icon={<Boxes className="size-4 shrink-0" />}>
              All Installations
            </NavLink>
          </nav>
        </div>
      </div>

      {/* User footer */}
      <div className="flex flex-col gap-2 border-t border-sidebar-foreground/10 p-3">
        <NavLink href="/dashboard/account" collapsed={collapsed} icon={<UserRound className="size-4 shrink-0" />}>
          <span className="truncate">{accountEmail}</span>
        </NavLink>
        <form action="/api/auth/logout" method="POST">
          <Button
            type="submit"
            variant="ghost"
            title={collapsed ? "Sign out" : undefined}
            className={
              "w-full text-sidebar-foreground/50 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground " +
              (collapsed ? "justify-center px-0" : "justify-start px-3")
            }
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && <span className="ml-2.5 truncate">Sign out</span>}
          </Button>
        </form>
      </div>
    </aside>
  );
}
