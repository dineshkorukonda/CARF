import Link from "next/link";
import { ThemeToggle } from "../../components/ThemeToggle";
import { Breadcrumbs } from "./Breadcrumbs";
import { InstallationSwitcher } from "./InstallationSwitcher";
import type { InstallationRow } from "../../lib/accountService";

export function Topbar({
  accountEmail,
  installations,
}: {
  accountEmail: string;
  installations: InstallationRow[];
}) {
  const initial = accountEmail.charAt(0).toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-4">
        <Breadcrumbs installations={installations} />
        {installations.length > 0 && (
          <InstallationSwitcher
            installations={installations}
            variant="topbar"
          />
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <span className="hidden text-sm text-muted-foreground sm:inline">{accountEmail}</span>
        <Link
          href="/dashboard/account"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background"
        >
          {initial}
        </Link>
      </div>
    </header>
  );
}
