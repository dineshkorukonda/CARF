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
  if (pathname === "/dashboard/setup") return [{ label: "Setup & Deployment" }];
  if (pathname === "/dashboard/verify") return [{ label: "Threshold Demo" }];
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

  if (pathname.startsWith("/dashboard/commits/")) {
    const parts = pathname.replace("/dashboard/commits/", "").split("/").filter(Boolean);
    const owner = parts[0] ? decodeURIComponent(parts[0]) : "";
    const repo = parts[1] ? decodeURIComponent(parts[1]) : "";
    const sha = parts[2] ? decodeURIComponent(parts[2]) : "";
    const crumbs: Crumb[] = [{ label: "Repositories", href: "/dashboard" }];
    if (owner && repo) {
      crumbs.push({ label: `${owner}/${repo}`, href: `/dashboard/repos/${owner}/${repo}` });
    }
    crumbs.push({ label: sha ? sha.slice(0, 7) : "Commit" });
    return crumbs;
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
