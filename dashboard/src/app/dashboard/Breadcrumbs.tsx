"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { InstallationRow } from "../../lib/accountService";

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Deliberately compact -- one or two segments, not a full Home/Installations/repo chain.
 * The sidebar already shows which installation and section are active (its own switcher +
 * highlighted nav item), so repeating that whole hierarchy here would just be noise.
 */
function buildCrumbs(pathname: string): Crumb[] {
  if (pathname === "/dashboard") return [{ label: "Repositories" }];
  if (pathname === "/dashboard/setup") return [{ label: "PM2 Setup" }];
  if (pathname === "/dashboard/verify") return [{ label: "Verify Harness" }];
  if (pathname === "/dashboard/settings" || pathname === "/dashboard/account" || pathname === "/dashboard/installations") {
    return [{ label: "Settings" }];
  }

  if (pathname.startsWith("/dashboard/repos")) {
    const subPath = pathname.replace("/dashboard/repos", "").replace(/^\//, "");
    if (!subPath) {
      return [{ label: "Repositories", href: "/dashboard" }];
    }
    return [
      { label: "Repositories", href: "/dashboard" },
      { label: subPath },
    ];
  }

  return [{ label: "Repositories", href: "/dashboard" }];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Breadcrumbs(_props: { installations?: InstallationRow[] }) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <nav className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {crumbs.map((crumb, index) => (
        <span key={index} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-muted-foreground/40">/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-foreground">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
