"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { InstallationRow } from "../../lib/accountService";

interface Crumb {
  label: string;
  href?: string;
}

function buildCrumbs(pathname: string, installations: InstallationRow[]): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Home", href: "/dashboard" }];

  if (pathname === "/dashboard") return crumbs;

  if (pathname === "/dashboard/account") {
    crumbs.push({ label: "Account" });
    return crumbs;
  }

  if (pathname === "/dashboard/installations") {
    crumbs.push({ label: "Installations" });
    return crumbs;
  }

  const match = pathname.match(/^\/dashboard\/(status|config|analytics)\/([^/]+)(\/rules)?$/);
  if (match) {
    const [, section, installationId, rulesSuffix] = match;
    const installation = installations.find((i) => i.installationId === installationId);
    crumbs.push({ label: "Installations", href: "/dashboard/installations" });
    crumbs.push({ label: installation?.targetLogin ?? installationId!, href: `/dashboard/status/${installationId}` });

    if (rulesSuffix) {
      crumbs.push({ label: "Rules" });
    } else {
      const sectionLabel = section === "status" ? "Status" : section === "config" ? "Configure" : "Analytics";
      crumbs.push({ label: sectionLabel });
    }
    return crumbs;
  }

  return crumbs;
}

export function Breadcrumbs({ installations }: { installations: InstallationRow[] }) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname, installations);

  return (
    <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {crumbs.map((crumb, index) => (
        <span key={index} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-muted-foreground/40">/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="uppercase tracking-wide hover:text-foreground">
              {crumb.label}
            </Link>
          ) : (
            <span className="uppercase tracking-wide text-foreground">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
