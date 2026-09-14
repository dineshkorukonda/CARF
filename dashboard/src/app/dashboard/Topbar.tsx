import Link from "next/link";
import { Breadcrumbs } from "./Breadcrumbs";
import { RefreshReposButton } from "./RefreshReposButton";
import { CheckCircle2 } from "lucide-react";
import type { InstallationRow } from "../../lib/accountService";

export function Topbar({
  accountEmail,
  installations,
}: {
  accountEmail: string;
  installations: InstallationRow[];
}) {
  const initial = accountEmail.charAt(0).toUpperCase();
  const primary = installations[0];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-4">
        <Breadcrumbs installations={installations} />
        {primary && (
          <div className="hidden md:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
            <CheckCircle2 className="size-3 text-emerald-600" />
            <span className="font-medium text-slate-700">GitHub: @{primary.targetLogin}</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500 font-mono">#{primary.installationId}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <RefreshReposButton size="sm" />
        <span className="hidden text-xs font-medium text-slate-600 sm:inline">{accountEmail}</span>
        <Link
          href="/dashboard/account"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
        >
          {initial}
        </Link>
      </div>
    </header>
  );
}
