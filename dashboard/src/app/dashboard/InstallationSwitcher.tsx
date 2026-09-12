"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import type { InstallationRow } from "../../lib/accountService";

export function InstallationSwitcher({
  installations,
  active,
  collapsed = false,
  variant = "sidebar",
}: {
  installations: InstallationRow[];
  active?: InstallationRow;
  collapsed?: boolean;
  variant?: "sidebar" | "topbar";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function getTargetHref(installationId: string): string {
    const match = pathname.match(/^\/dashboard\/(status|config|rules|analytics|verify)(?:\/[^/]+)?(.*)/);
    if (match) {
      const [, section, suffix] = match;
      if (section === "config" && suffix === "/rules") {
        return `/dashboard/config/${installationId}/rules`;
      }
      return `/dashboard/${section}/${installationId}${suffix ?? ""}`;
    }
    return `/dashboard/status/${installationId}`;
  }

  if (!active && installations.length === 0) {
    return (
      <Link
        href="/api/github-app/install/start"
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
      >
        <Plus className="size-3 text-primary" />
        <span>Connect repo</span>
      </Link>
    );
  }

  const currentActive = active ?? installations[0];

  return (
    <div ref={rootRef} className={`relative ${variant === "sidebar" ? "mx-3" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? currentActive?.targetLogin : undefined}
        className={
          variant === "topbar"
            ? "flex items-center gap-2 rounded-sm border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            : "flex w-full items-center justify-between rounded-sm border border-sidebar-foreground/15 px-3 py-2 transition-colors hover:bg-sidebar-foreground/5 " +
              (collapsed ? "justify-center" : "")
        }
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
          {!collapsed && (
            <span className="max-w-[140px] truncate font-mono text-xs sm:max-w-[200px]">
              {currentActive?.targetLogin ?? "Select repository"}
            </span>
          )}
        </span>
        {!collapsed && <ChevronDown className="size-3 shrink-0 text-muted-foreground opacity-60" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-56 rounded-sm border border-border bg-popover p-1 shadow-md text-popover-foreground">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Connected Repositories ({installations.length})
          </div>

          <div className="max-h-60 overflow-y-auto py-1 divide-y divide-border/40">
            {installations.map((installation) => {
              const isCurrent = installation.installationId === currentActive?.installationId;
              return (
                <Link
                  key={installation.id}
                  href={getTargetHref(installation.installationId)}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs transition-colors rounded-xs ${
                    isCurrent
                      ? "bg-primary/10 text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate font-mono">
                    <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span className="truncate">{installation.targetLogin}</span>
                  </span>
                  {isCurrent && <Check className="size-3 text-primary shrink-0" />}
                </Link>
              );
            })}
          </div>

          <div className="border-t border-border mt-1 pt-1">
            <Link
              href="/api/github-app/install/start"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-primary font-medium hover:bg-muted rounded-xs transition-colors"
            >
              <Plus className="size-3" />
              <span>+ Connect another repo</span>
            </Link>
            <Link
              href="/dashboard/installations"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Manage installations</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
