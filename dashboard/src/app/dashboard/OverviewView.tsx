"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderGit2,
  ExternalLink,
  ShieldCheck,
  Zap,
  Clock,
  AlertTriangle,
  Search,
  CheckCircle2,
  Sliders,
  Activity,
  Layers,
} from "lucide-react";
import type { InstallationRepo } from "../../adapters/github/reposClient";
import type { RecentCommit } from "../../adapters/coreApi/client";
import type { InstallationRow } from "../../lib/accountService";
import { RefreshReposButton } from "./RefreshReposButton";
import { PipelineStageTracker } from "./PipelineStageTracker";
import { RepoProtectionWizardModal } from "./RepoProtectionWizardModal";

export interface RepoProtectionStatus {
  isProtected: boolean;
  hasWorkflow: boolean;
  mode?: string;
}

export function OverviewView({
  installation,
  repos,
  commits,
  accountEmail,
}: {
  installation: InstallationRow;
  repos: InstallationRepo[];
  commits: RecentCommit[];
  accountEmail: string;
}) {
  const [repoSearch, setRepoSearch] = useState("");
  const [protectionMap, setProtectionMap] = useState<Record<string, RepoProtectionStatus>>({});
  const [wizardTargetRepo, setWizardTargetRepo] = useState<InstallationRepo | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadStatuses() {
      try {
        const res = await fetch(`/api/repo/status?installationId=${installation.installationId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.statuses && Array.isArray(data.statuses) && isMounted) {
          const map: Record<string, RepoProtectionStatus> = {};
          for (const s of data.statuses) {
            map[s.name] = { isProtected: s.isProtected, hasWorkflow: s.hasWorkflow, mode: s.mode };
            map[s.fullName] = { isProtected: s.isProtected, hasWorkflow: s.hasWorkflow, mode: s.mode };
          }
          setProtectionMap(map);
        }
      } catch (err) {
        console.warn("[OverviewView] Failed to load repo statuses:", err);
      }
    }
    loadStatuses();
    return () => {
      isMounted = false;
    };
  }, [installation.installationId]);


  const filteredRepos = useMemo(() => {
    if (!repoSearch.trim()) return repos;
    const q = repoSearch.toLowerCase();
    return repos.filter(
      (r) => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q)
    );
  }, [repos, repoSearch]);

  // Compute live overview metrics
  const totalCommits = commits.length;
  const now = Date.now();
  const activeWatchdogs = commits.filter(
    (c) =>
      c.rolledBack === null &&
      c.finalWindow &&
      new Date(c.createdAt).getTime() + c.finalWindow * 1000 > now
  ).length;
  const rollbacksTriggered = commits.filter((c) => c.rolledBack === true).length;
  const avgThreshold =
    totalCommits > 0
      ? (
          (commits.reduce((acc, c) => acc + (c.finalThreshold ?? 0.05), 0) / totalCommits) *
          100
        ).toFixed(1)
      : "5.0";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 md:p-8">
      {/* ── Top Integration Summary Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start md:items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-lg shadow-sm">
            C
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {installation.targetLogin}&apos;s Repositories
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="size-3 text-emerald-600" />
                Active & Protected
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Connected via GitHub Integration #{installation.installationId} • {repos.length} repositories monitored
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <RefreshReposButton size="sm" />
          <a
            href={`https://github.com/settings/installations/${installation.installationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors"
          >
            <span>Configure on GitHub</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      {/* ── High-Level Cross-Project Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Rollouts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Total Commits Analyzed
            </span>
            <Activity className="size-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{totalCommits}</span>
            <span className="text-xs text-slate-500">rollouts</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">AST classified via Tier-1 & Tier-2</p>
        </div>

        {/* Metric 2: Active Watchdogs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Active Watchdogs
            </span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{activeWatchdogs}</span>
            {activeWatchdogs > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 animate-pulse">
                Live
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">In observation window right now</p>
        </div>

        {/* Metric 3: Outages Prevented */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Prevented Outages
            </span>
            <ShieldCheck className="size-4 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{rollbacksTriggered}</span>
            <span className="text-xs text-emerald-700 font-medium">auto-rollbacks</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Zero human intervention needed</p>
        </div>

        {/* Metric 4: Avg Dynamic Budget */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Avg Dynamic Budget
            </span>
            <Zap className="size-4 text-indigo-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{avgThreshold}%</span>
            <span className="text-xs text-slate-500">error ceiling</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Calibrated to code churn risk</p>
        </div>
      </div>

      {/* ── Protected Repositories Directory ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Protected Repositories ({repos.length})</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Repositories monitored by CARF for change-aware rollbacks and dynamic error budgets.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={repoSearch}
              onChange={(e) => setRepoSearch(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        {filteredRepos.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No repositories found matching &ldquo;{repoSearch}&rdquo;.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredRepos.map((repo) => {
              const status = protectionMap[repo.name] || protectionMap[repo.full_name];
              const isProtected = status?.isProtected ?? false;

              return (
                <div
                  key={repo.id}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors shadow-none"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm truncate">
                        <FolderGit2 className="size-4 text-slate-400 shrink-0" />
                        <span className="truncate">{repo.name}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {repo.private && (
                          <span className="rounded bg-amber-50 border border-amber-200 px-1 py-0.2 text-[9px] font-medium text-amber-700">
                            Private
                          </span>
                        )}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                          {repo.default_branch}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 truncate">{repo.full_name}</p>

                    <div className="mt-2.5 flex items-center gap-1.5">
                      {isProtected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          Protected (.carf.yml active)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          <span className="size-1.5 rounded-full bg-slate-400" />
                          Unconfigured (Defaults)
                        </span>
                      )}
                    </div>

                    {repo.pushed_at && (
                      <p className="mt-2 text-[11px] text-slate-500 font-mono">
                        Pushed: {new Date(repo.pushed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    {isProtected ? (
                      <>
                        <Link
                          href={`/dashboard/status/${installation.installationId}?repo=${repo.name}`}
                          className="font-medium text-slate-700 hover:text-slate-900 transition-colors"
                        >
                          View Status &rarr;
                        </Link>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setWizardTargetRepo(repo)}
                            className="text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Update CARF configuration"
                          >
                            Reprotect
                          </button>
                          <Link
                            href={`/dashboard/config/${installation.installationId}`}
                            className="text-slate-400 hover:text-slate-700 transition-colors"
                            title="Configure thresholds"
                          >
                            <Sliders className="size-3.5" />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setWizardTargetRepo(repo)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                        >
                          <Zap className="size-3 text-amber-300" />
                          <span>1-Click Protect</span>
                        </button>
                        <Link
                          href={`/dashboard/status/${installation.installationId}?repo=${repo.name}`}
                          className="text-slate-400 hover:text-slate-700 transition-colors"
                          title="View Status"
                        >
                          Status &rarr;
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Global Cross-Project Live Rollouts Feed ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Live Rollout Pipeline</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Recent classified commits and active watchdogs across all protected repositories.
            </p>
          </div>
          <Link
            href={`/dashboard/status/${installation.installationId}`}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-4"
          >
            Full Rollout Logs &rarr;
          </Link>
        </div>

        <PipelineStageTracker commits={commits} />
      </div>

      {/* ── 1-Click Protection Wizard Modal ── */}
      {wizardTargetRepo && (
        <RepoProtectionWizardModal
          isOpen={true}
          onClose={() => setWizardTargetRepo(null)}
          installationId={installation.installationId}
          repo={wizardTargetRepo}
          onProtectionSuccess={(repoFullName) => {
            setProtectionMap((prev) => ({
              ...prev,
              [wizardTargetRepo.name]: { isProtected: true, hasWorkflow: true, mode: "balanced" },
              [repoFullName]: { isProtected: true, hasWorkflow: true, mode: "balanced" },
            }));
          }}
        />
      )}
    </div>
  );
}
