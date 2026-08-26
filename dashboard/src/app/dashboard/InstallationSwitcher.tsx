"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { InstallationRow } from "../../lib/accountService";

export function InstallationSwitcher({
  installations,
  active,
  collapsed,
}: {
  installations: InstallationRow[];
  active: InstallationRow;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative mx-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? active.targetLogin : undefined}
        className={
          "flex w-full items-center justify-between rounded-sm border border-sidebar-foreground/15 px-3 py-2 transition-colors hover:bg-sidebar-foreground/5 " +
          (collapsed ? "justify-center" : "")
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-[#5b6cff]" />
          {!collapsed && <span className="truncate text-sm font-semibold">{active.targetLogin}</span>}
        </span>
        {!collapsed && <ChevronDown className="size-3.5 shrink-0 text-sidebar-foreground/40" />}
      </button>

      {open && installations.length > 1 && (
        <div className="absolute top-full left-0 z-10 mt-1 w-56 rounded-sm border border-sidebar-foreground/15 bg-sidebar py-1 shadow-lg">
          {installations.map((installation) => (
            <Link
              key={installation.id}
              href={`/dashboard/status/${installation.installationId}`}
              onClick={() => setOpen(false)}
              className={
                "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors " +
                (installation.installationId === active.installationId
                  ? "text-sidebar-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground")
              }
            >
              <span className="size-1.5 shrink-0 rounded-full bg-[#5b6cff]" />
              <span className="truncate">{installation.targetLogin}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
