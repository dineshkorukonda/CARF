import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { projectCommitsHref } from "../../lib/dashboardNav";

export function ProjectBackLink({
  installationId,
  repoFullName,
}: {
  installationId: string;
  repoFullName: string;
}) {
  const href = projectCommitsHref(installationId, repoFullName);
  if (!href) return null;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
    >
      <ArrowLeft className="size-3.5" />
      <span>Back to {repoFullName}</span>
    </Link>
  );
}
