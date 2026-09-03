"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Radio, Settings2, Sliders } from "lucide-react";
import { ApiKeyCopyButton } from "./installations/ApiKeyCopyButton";

interface RepoNavigationTabsProps {
  installationId: string;
  repoName?: string;
  apiKey?: string | null;
}

export function RepoNavigationTabs({
  installationId,
  repoName,
  apiKey,
}: RepoNavigationTabsProps) {
  const pathname = usePathname();

  const isStatus = pathname.startsWith(`/dashboard/status/${installationId}`);
  const isRules = pathname.startsWith(`/dashboard/config/${installationId}/rules`);
  const isConfig = pathname.startsWith(`/dashboard/config/${installationId}`) && !isRules;
  const isAnalytics = pathname.startsWith(`/dashboard/analytics/${installationId}`);

  const tabs = [
    {
      label: "Live Status",
      href: `/dashboard/status/${installationId}`,
      active: isStatus,
      icon: Radio,
    },
    {
      label: "Deployment Adapter",
      href: `/dashboard/config/${installationId}${repoName ? `?repo=${encodeURIComponent(repoName)}` : ""}`,
      active: isConfig,
      icon: Settings2,
    },
    {
      label: "Threshold Rules",
      href: `/dashboard/config/${installationId}/rules${repoName ? `?repo=${encodeURIComponent(repoName)}` : ""}`,
      active: isRules,
      icon: Sliders,
    },
    {
      label: "Rollout Analytics",
      href: `/dashboard/analytics/${installationId}`,
      active: isAnalytics,
      icon: BarChart3,
    },
  ];

  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-semibold text-foreground">
            {repoName ?? "Repository Workspace"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            (id: {installationId})
          </span>
        </div>
        {apiKey && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>API Key:</span>
            <ApiKeyCopyButton apiKey={apiKey} />
          </div>
        )}
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                tab.active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5 shrink-0" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
