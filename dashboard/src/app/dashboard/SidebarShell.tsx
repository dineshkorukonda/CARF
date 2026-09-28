"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  FolderGit2,
  Activity,
  Terminal,
  ShieldCheck,
  Sliders,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  UserRound,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import type { InstallationRow } from "../../lib/accountService";

const COLLAPSE_STORAGE_KEY = "carf.sidebar.collapsed";

const NAV_ITEMS = [
  { href: "/dashboard", exact: true, label: "Repositories", icon: FolderGit2 },
  { href: "/dashboard/repos", exact: false, label: "Rollouts & Controls", icon: Activity },
  { href: "/dashboard/setup", exact: false, label: "PM2 Setup", icon: Terminal },
  { href: "/dashboard/verify", exact: false, label: "Verification Harness", icon: ShieldCheck },
  { href: "/dashboard/settings", exact: false, label: "Settings", icon: Sliders },
];

function NavLink({
  href,
  exact,
  icon: Icon,
  collapsed,
  children,
}: {
  href: string;
  exact?: boolean;
  icon: any;
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
      <Icon className="size-4 shrink-0" />
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
      if (stored) {
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

  const primary = installations[0];

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
              <Image src="/icon.png" alt="CARF" width={22} height={22} className="rounded-sm shrink-0" />
            ) : (
              <span className="flex items-center gap-2">
                <Image src="/icon.png" alt="CARF" width={20} height={20} className="rounded-sm shrink-0" />
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

        {/* Global Navigation - Strictly the 5 routes */}
        <div className="flex flex-col gap-2">
          {!collapsed && (
            <div className="px-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                Menu
              </p>
            </div>
          )}
          <nav className="flex flex-col gap-0.5 px-3">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                exact={item.exact}
                collapsed={collapsed}
                icon={item.icon}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {primary && (
          <div className="mt-2 border-t border-sidebar-foreground/10 pt-4">
            {!collapsed ? (
              <div className="mx-3 rounded-lg border border-sidebar-foreground/15 bg-sidebar-foreground/5 p-2.5">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-xs text-sidebar-foreground truncate">
                    @{primary.targetLogin}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-sidebar-foreground/60 font-mono">
                  Integration #{primary.installationId}
                </p>
              </div>
            ) : (
              <div className="flex justify-center my-1" title={`@${primary.targetLogin} (#${primary.installationId})`}>
                <div className="size-2.5 rounded-full bg-emerald-500" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* User footer */}
      <div className="flex flex-col gap-2 border-t border-sidebar-foreground/10 p-3">
        <Link
          href="/dashboard/settings"
          title={collapsed ? accountEmail : undefined}
          className="flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground transition-colors"
        >
          <UserRound className="size-4 shrink-0" />
          {!collapsed && <span className="truncate">{accountEmail}</span>}
        </Link>
        <Button
          type="button"
          variant="ghost"
          title={collapsed ? "Sign out" : undefined}
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={
            "w-full text-sidebar-foreground/50 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground " +
            (collapsed ? "justify-center px-0" : "justify-start px-3")
          }
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span className="ml-2.5 truncate">Sign out</span>}
        </Button>
      </div>
    </aside>
  );
}
