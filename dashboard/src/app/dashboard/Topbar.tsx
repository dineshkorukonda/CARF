"use client";

import { usePathname } from "next/navigation";

function pageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Overview";
  if (pathname.includes("/status/")) return "Live status";
  if (pathname.endsWith("/rules")) return "Classification & threshold";
  if (pathname.includes("/config/")) return "Mode & adapter";
  return "Dashboard";
}

export function Topbar({ accountEmail }: { accountEmail: string }) {
  const pathname = usePathname();
  const initial = accountEmail.charAt(0).toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-6">
      <h1 className="text-sm font-semibold">{pageTitle(pathname)}</h1>
      <div className="flex items-center gap-2.5">
        <span className="hidden text-sm text-muted-foreground sm:inline">{accountEmail}</span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">
          {initial}
        </span>
      </div>
    </header>
  );
}
