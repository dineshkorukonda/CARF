"use client";

import { Suspense, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  FolderGit2,
  Sliders,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  LayoutDashboard,
  GitCommitHorizontal,
  GitPullRequest,
  RotateCcw,
  History,
  Settings2,
  PlugZap,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import type { InstallationRow } from "../../lib/accountService";
import { DASHBOARD_NAV_GROUPS, projectSectionsForAnalysis, projectSectionHref, type ProjectSection } from "../../lib/dashboardNav";
import { AnalysisTriggerSchema, type AnalysisTrigger } from "../../lib/carfConfigSchema";

const COLLAPSE_STORAGE_KEY = "carf.sidebar.collapsed";

const NAV_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "/dashboard": FolderGit2,
  "/dashboard/integrations": PlugZap,
  "/dashboard/settings": Sliders,
};

const PROJECT_ICONS = {
  overview: LayoutDashboard,
  commits: GitCommitHorizontal,
  pull_requests: GitPullRequest,
  rollouts: RotateCcw,
  activity: History,
  settings: Settings2,
} satisfies Record<ProjectSection, ComponentType<{ className?: string }>>;

function ProjectNavigation({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = pathname.split("/").filter(Boolean);
  const isProject = segments[0] === "dashboard" && (segments[1] === "repos" || segments[1] === "commits");
  const identity = isProject && segments.length >= 4 ? `${segments[2]}/${segments[3]}` : "";
  const [selection, setSelection] = useState<{ identity: string; trigger: AnalysisTrigger } | null>(null);
  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    const [owner, repo] = identity.split("/").map(decodeURIComponent);
    const read = () => fetch(`/api/repo/analysis-mode?${new URLSearchParams({ owner: owner!, repo: repo! })}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Settings unavailable");
        const data = await response.json();
        setSelection({ identity, trigger: AnalysisTriggerSchema.parse(data.analysisTrigger) });
      }).catch(() => { if (!controller.signal.aborted) setSelection({ identity, trigger: "both" }); });
    void read();
    window.addEventListener("carf-analysis-settings-saved", read);
    return () => { controller.abort(); window.removeEventListener("carf-analysis-settings-saved", read); };
  }, [identity]);
  if (!isProject || segments.length < 4) return null;
  const owner = decodeURIComponent(segments[2]!);
  const repo = decodeURIComponent(segments[3]!);
  const selected = segments[1] === "commits" ? "commits" : searchParams.get("view") ?? "overview";

  return (
    <div className="border-t border-sidebar-foreground/10 pt-4">
      {!collapsed && (
        <div className="px-4 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Project</p>
          <p className="mt-1 truncate text-xs font-semibold text-sidebar-foreground" title={`${owner}/${repo}`}>{repo}</p>
        </div>
      )}
      <nav aria-label="Project" className="flex flex-col gap-0.5 px-3">
        {projectSectionsForAnalysis(selection?.identity === identity ? selection.trigger : "both").map((section) => {
          const Icon = PROJECT_ICONS[section];
          const active = (selected === "metrics" ? "overview" : selected) === section;
          return (
            <Link key={section} href={projectSectionHref(owner, repo, section)} title={collapsed ? section === "pull_requests" ? "Pull requests" : section : undefined}
              aria-current={active ? "page" : undefined}
              className={"flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium capitalize transition-colors " +
                (active ? "bg-sidebar-foreground text-sidebar" : "text-sidebar-foreground/60 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground")}>
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span>{section === "pull_requests" ? "Pull requests" : section}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavLink({
  href,
  exact,
  icon: Icon,
  collapsed,
  children,
}: {
  href: string;
  exact?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-label={String(children)}
      aria-current={active ? "page" : undefined}
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
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (stored !== null) {
        queueMicrotask(() => {
          setCollapsed(stored === "true");
        });
      }
    } catch {}
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }

  const initial = (accountEmail.trim().charAt(0) || "U").toUpperCase();

  return (
    <aside
      className={
        "group/sidebar flex flex-col justify-between overflow-y-auto border-r border-sidebar-foreground/10 bg-sidebar text-sidebar-foreground transition-[width] duration-150 ease-out shrink-0 select-none " +
        (collapsed ? "w-16" : "w-64")
      }
    >
      {/* Brand header */}
      <div className="flex flex-col gap-4">
        <div className={"flex items-center border-b border-sidebar-foreground/10 " + (collapsed ? "flex-col gap-2 px-2 py-3" : "h-14 justify-between px-4")}>
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 font-bold tracking-tight text-sidebar-foreground"
          >
            <span className="font-mono text-xs font-black tracking-widest bg-sidebar-foreground text-sidebar px-1.5 py-0.5 rounded">
              CARF
            </span>
            {!collapsed && (
              <span className="text-xs font-semibold tracking-tight truncate">
                Dashboard
              </span>
            )}
          </Link>

          <Button
            size="icon"
            variant="ghost"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="size-7 text-sidebar-foreground/60 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <ChevronsLeft className="size-4" />
            )}
          </Button>
        </div>

        {/* Global navigation grouped by logical category */}
        <nav aria-label="Main" className="flex flex-col gap-4 px-3">
          {DASHBOARD_NAV_GROUPS.map((group) => (
            <div key={group.id} className="flex flex-col gap-0.5">
              {!collapsed && (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = NAV_ICONS[item.href] ?? FolderGit2;
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    exact={item.exact}
                    icon={Icon}
                    collapsed={collapsed}
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Active project subnavigation when inside a repository context */}
        <Suspense fallback={null}>
          <ProjectNavigation collapsed={collapsed} />
        </Suspense>
      </div>

      {/* Account footer */}
      <div className="border-t border-sidebar-foreground/10 p-3">
        <div
          className={
            "flex items-center gap-2.5 rounded-sm p-1.5 " +
            (collapsed ? "justify-center" : "justify-between")
          }
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-foreground/15 text-xs font-semibold text-sidebar-foreground">
              {initial}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-sidebar-foreground">
                  {accountEmail}
                </p>
                <p className="text-[10px] text-sidebar-foreground/50">
                  {installations.length === 1
                    ? "1 installation connected"
                    : `${installations.length} installations`}
                </p>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
              aria-label="Sign out"
              className="rounded p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground cursor-pointer"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
