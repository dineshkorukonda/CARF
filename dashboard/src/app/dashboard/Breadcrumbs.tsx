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
function buildCrumbs(pathname: string, installations: InstallationRow[]): Crumb[] {
  if (pathname === "/dashboard") return [{ label: "Home" }];
  if (pathname === "/dashboard/account") return [{ label: "Account" }];
  if (pathname === "/dashboard/installations") return [{ label: "All installations" }];

  const match = pathname.match(/^\/dashboard\/(status|config|analytics)\/([^/]+)(\/rules)?$/);
  if (match) {
    const [, section, installationId, rulesSuffix] = match;
    const installation = installations.find((i) => i.installationId === installationId);
    const repoLabel = installation?.targetLogin ?? installationId!;
    const sectionLabel = rulesSuffix
      ? "Rules"
      : section === "status"
        ? "Status"
        : section === "config"
          ? "Configure"
          : "Analytics";

    return [{ label: repoLabel, href: `/dashboard/status/${installationId}` }, { label: sectionLabel }];
  }

  return [{ label: "Home", href: "/dashboard" }];
}

export function Breadcrumbs({ installations }: { installations: InstallationRow[] }) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname, installations);

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
