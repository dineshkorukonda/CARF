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
      activeColor: "text-emerald-500",
    },
    {
      label: "Deployment Adapter",
      href: `/dashboard/config/${installationId}`,
      active: isConfig,
      icon: Settings2,
      activeColor: "text-slate-900",
    },
    {
      label: "Threshold Rules",
      href: `/dashboard/config/${installationId}/rules`,
      active: isRules,
      icon: Sliders,
      activeColor: "text-slate-900",
    },
    {
      label: "Rollout Analytics",
      href: `/dashboard/analytics/${installationId}`,
      active: isAnalytics,
      icon: BarChart3,
      activeColor: "text-slate-900",
    },
    {
      label: "Testing Playbook",
      href: `/dashboard/testing`,
      active: pathname === "/dashboard/testing",
      icon: BookOpen,
    },
  ];

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-semibold text-slate-900">
            {repoName ? (repoName.startsWith("@") ? repoName : `@${repoName}`) : "Repository Workspace"}
          </span>
          <span className="font-mono text-xs text-slate-500">
            (Integration #{installationId})
          </span>
        </div>
        {apiKey && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>API Key:</span>
            <ApiKeyCopyButton apiKey={apiKey} />
          </div>
        )}
      </div>

      <nav className="flex items-center gap-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                tab.active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`size-3.5 shrink-0 ${tab.active ? "text-white" : tab.activeColor}`} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
