"use client";

import { useDashboardDates } from "../../lib/useDashboardDates";

import React, { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Terminal,
  Activity,
  RotateCcw,
  Clock,
  ArrowRight,
  PlugZap,
  Check,
  LayoutList,
  LayoutGrid,
  GitBranch,
} from "lucide-react";
import {
  deriveRepoStatus,
  getStatusBadgeVariant,
  deriveAgentStatus,
} from "../../lib/repoStatusDerivation";
import {
  resolveRepoMode,
  repoIdentityKey,
} from "../../lib/deploymentMode";
import { resolveFromLegacy } from "../../lib/capabilities";
import { CARF_TERMS, CAPABILITY_LABELS } from "../../lib/terminology";
import { commitPageHref } from "../../lib/dashboardNav";
import { RolloutOutcomeChart, type OutcomeDayBucket } from "./RolloutOutcomeChart";
import { Button } from "../../components/ui/button";

const viewModeListeners = new Set<() => void>();

function subscribeViewMode(callback: () => void) {
  viewModeListeners.add(callback);
  return () => {
    viewModeListeners.delete(callback);
  };
}

function getViewModeSnapshot(): "compact" | "detailed" {
  if (typeof window === "undefined") return "compact";
  try {
    const saved = localStorage.getItem("carf_repo_view_mode");
    return saved === "detailed" ? "detailed" : "compact";
  } catch {
    return "compact";
  }
}

function getViewModeServerSnapshot(): "compact" | "detailed" {
  return "compact";
}

function setStoredViewMode(mode: "compact" | "detailed") {
  try {
    localStorage.setItem("carf_repo_view_mode", mode);
  } catch {}
  viewModeListeners.forEach((listener) => listener());
}

interface RepoItem {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  default_branch: string;
  private: boolean;
}

interface RepoConnectionItem {
  id: string;
  installationId: string;
  owner: string;
  repo: string;
  mode?: string | null;
  runtimeAdapter?: string | null;
  deploymentIntegration?: string | null;
  agentLastHeartbeat?: Date | string | null;
  agentRevoked?: boolean | null;
  storedConfig?: unknown;
  verifiedAt?: Date | string | null;
  monitoringPaused?: boolean;
}

interface RolloutOutcomeItem {
  id: string;
  commitSha: string;
  owner: string | null;
  repo: string | null;
  status: "SUCCESS" | "ROLLED_BACK" | "FAILED" | "PENDING";
  threshold: number;
  window: number;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  rolledBack: boolean;
  reason?: string | null;
}

interface CommitItem {
  id: string;
  sha: string;
  owner: string;
  repo: string;
  createdAt: Date | string;
  threshold?: {
    finalThreshold: number;
    finalWindow: number;
    activeTypes?: string[];
  } | null;
  changeVector?: {
    code: number;
    config: number;
    dependency: number;
    infra: number;
    codeComplexity?: number;
  } | null;
}

interface RepoListViewProps {
  repos: RepoItem[];
  connections: RepoConnectionItem[];
  standaloneRollouts?: RolloutOutcomeItem[];
  rollouts?: RolloutOutcomeItem[];
  commits?: CommitItem[];
  activityError?: string | null;
}

function connectionFor(
  connections: RepoConnectionItem[],
  owner: string,
  name: string
): RepoConnectionItem | undefined {
  return connections.find(
    (c) => repoIdentityKey(c.owner, c.repo) === repoIdentityKey(owner, name)
  );
}

export function RepoListView({
  repos,
  connections,
  standaloneRollouts: standaloneRolloutsProp,
  rollouts: rolloutsProp,
  commits = [],
  activityError = null,
}: RepoListViewProps) {
  const dates = useDashboardDates();
  const viewMode = useSyncExternalStore(
    subscribeViewMode,
    getViewModeSnapshot,
    getViewModeServerSnapshot
  );

  const standaloneRollouts = useMemo(
    () => standaloneRolloutsProp ?? rolloutsProp ?? [],
    [standaloneRolloutsProp, rolloutsProp]
  );

  const totalCommits = commits.length;
  const totalRollouts = standaloneRollouts.length;
  const rolledBackCount = standaloneRollouts.filter(
    (r) => r.status === "ROLLED_BACK"
  ).length;
  const activePendingCount = standaloneRollouts.filter(
    (r) => r.status === "PENDING"
  ).length;

  const chartData = useMemo(() => {
    const buckets: Record<string, OutcomeDayBucket> = {};
    for (const key of dates.recentDays(14)) {
      buckets[key] = {
        date: key.slice(5),
        SUCCESS: 0,
        ROLLED_BACK: 0,
        FAILED: 0,
        PENDING: 0,
        total: 0,
      };
    }

    standaloneRollouts.forEach((r) => {
      const dateKey = dates.dayKey(r.startedAt);
      if (buckets[dateKey]) {
        buckets[dateKey][r.status] = (buckets[dateKey][r.status] || 0) + 1;
        buckets[dateKey].total += 1;
      }
    });

    return Object.values(buckets);
  }, [dates, standaloneRollouts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Repositories</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            3-Layer Deployment Intelligence: CARF Core policy, deployment integrations, and runtime observability.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/dashboard/integrations" />}>
            <PlugZap className="size-3.5" />
            Integrations
          </Button>
          <Button nativeButton={false} size="sm" render={<Link href="/dashboard/setup" />}>
            Add Repository
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Commits Analyzed</span>
            <Activity className="size-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalCommits}</span>
            <span className="text-xs text-muted-foreground">webhook records</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">CARF Core intake across all repositories</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Active Rollouts</span>
            <Terminal className="size-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalRollouts}</span>
            <span className="text-xs text-muted-foreground">monitored</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Runtime-observed deployment loops</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Rollbacks Executed</span>
            <RotateCcw className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{rolledBackCount}</span>
            <span className="text-xs text-muted-foreground">of {totalRollouts} rollouts</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Automated threshold-breach rollbacks</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Observation Loops</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{activePendingCount}</span>
            <span className="text-xs text-muted-foreground">
              {activePendingCount > 0 ? "in soak window" : "idle"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {activePendingCount > 0
              ? "Live soak observation loops in progress"
              : "No active observation windows"}
          </p>
        </div>
      </div>

      {(standaloneRollouts.length > 0 || commits.length > 0) && (
        <RolloutOutcomeChart
          data={chartData}
          commits={commits}
          rollouts={standaloneRollouts}
          totalRollouts={totalRollouts}
          rolledBackCount={rolledBackCount}
          activePendingCount={activePendingCount}
        />
      )}

      <div className="space-y-4">
        {/* Section Header with View Mode Switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-foreground">Connected Repositories</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {repos.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Repositories with active CARF Core policies, deployment integrations, and runtime observability.
            </p>
          </div>

          <div className="flex items-center gap-1 self-start sm:self-auto rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setStoredViewMode("compact")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                viewMode === "compact"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Compact view"
            >
              <LayoutList className="size-3.5" />
              <span>Compact</span>
            </button>
            <button
              type="button"
              onClick={() => setStoredViewMode("detailed")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                viewMode === "detailed"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Detailed view"
            >
              <LayoutGrid className="size-3.5" />
              <span>Detailed</span>
            </button>
          </div>
        </div>

        {repos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <FolderGit2 className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-2 text-xs font-semibold text-foreground">No connected repositories</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a repository to configure deployment integrations and runtime integrations.
            </p>
            <Link
              href="/dashboard/setup"
              className="mt-4 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Add Repository
            </Link>
          </div>
        ) : viewMode === "compact" ? (
          /* COMPACT VIEW: High-density, professional SaaS list */
          <div className="space-y-3">
            {repos.map((repo) => {
              const repoConn = connectionFor(connections, repo.owner, repo.name);
              const resolved = resolveFromLegacy(repoConn || {});
              const mode = resolveRepoMode(repoConn);
              const repoRollouts = standaloneRollouts.filter(
                (r) =>
                  r.owner?.toLowerCase() === repo.owner.toLowerCase() &&
                  r.repo?.toLowerCase() === repo.name.toLowerCase()
              );
              const latestRollout = repoRollouts[0];
              const recentCommits = commits
                .filter((c) => repoIdentityKey(c.owner, c.repo) === repoIdentityKey(repo.owner, repo.name))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3);
              const derivedStatus = deriveRepoStatus({
                isConfigured: Boolean(repoConn),
                isVerified: Boolean(repoConn?.verifiedAt),
                hasPendingRollout: repoRollouts.some((r) => r.status === "PENDING"),
                latestOutcomeStatus: latestRollout?.status ?? null,
                totalRollouts: repoRollouts.length,
                mode,
              });
              const badge = getStatusBadgeVariant(derivedStatus);
              const cfg = (repoConn?.storedConfig ?? {}) as Record<string, unknown>;
              const pm2Target = typeof cfg.target === "string" ? cfg.target : undefined;

              return (
                <article
                  key={repo.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-xs hover:border-border/80 transition-all space-y-3"
                >
                  {/* Row 1: Repo Title, Badges, Status, and View Details */}
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
                      <Link
                        href={`/dashboard/repos/${repo.owner}/${repo.name}`}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors"
                      >
                        {repo.full_name}
                      </Link>
                      <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                        <GitBranch className="size-3" />
                        {repo.default_branch}
                      </span>
                      <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary">
                        {resolved.integrationLabel.toUpperCase()}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                          resolved.runtimeStatus === "active"
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                            : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        {resolved.runtimeLabel.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${badge.colorClass.split(" ")[1] ?? "text-foreground"}`}>
                        <span className={`size-2 rounded-full ${badge.dotClass}`} />
                        <span>{derivedStatus}</span>
                      </span>
                      <Link
                        href={`/dashboard/repos/${repo.owner}/${repo.name}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors ml-1"
                      >
                        <span>View details</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Row 2: Standardized Architecture Specifications & Capabilities */}
                  <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs border-t border-border/40 pt-2.5">
                    <div className="flex items-center gap-1.5">
                      <dt className="text-[11px] font-medium text-muted-foreground">{CARF_TERMS.deploymentIntegration.label}:</dt>
                      <dd className="text-[11px] font-semibold text-foreground">{resolved.integrationLabel}</dd>
                    </div>
                    <span className="text-muted-foreground/30">•</span>
                    <div className="flex items-center gap-1.5">
                      <dt className="text-[11px] font-medium text-muted-foreground">{CARF_TERMS.runtimeIntegration.label}:</dt>
                      <dd className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                        <span>{resolved.runtimeLabel}</span>
                        {resolved.runtimeStatus === "active" && (
                          <span className="text-[10px] text-emerald-500 font-bold">● Active</span>
                        )}
                      </dd>
                    </div>
                    {pm2Target && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <div className="flex items-center gap-1.5">
                          <dt className="text-[11px] font-medium text-muted-foreground">{CARF_TERMS.deploymentTarget.label}:</dt>
                          <dd className="text-[11px] font-mono font-semibold text-foreground">{pm2Target}</dd>
                        </div>
                      </>
                    )}
                    <span className="text-muted-foreground/30">•</span>
                    <div className="flex items-center gap-1.5">
                      <dt className="text-[11px] font-medium text-muted-foreground">Runtime Status:</dt>
                      <dd className="text-[11px] font-semibold text-foreground">{derivedStatus}</dd>
                    </div>
                    <span className="text-muted-foreground/30">•</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <dt className="text-[11px] font-medium text-muted-foreground">Available Capabilities:</dt>
                      <dd className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium px-1.5 py-0.2 text-[10px] border border-emerald-500/20">
                          <Check className="size-2.5" />
                          <span>{CAPABILITY_LABELS.policy}</span>
                        </span>
                        {resolved.capabilities.monitoring ? (
                          <span className="inline-flex items-center gap-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 font-medium px-1.5 py-0.2 text-[10px] border border-sky-500/20">
                            <Check className="size-2.5" />
                            <span>{CAPABILITY_LABELS.monitoring}</span>
                          </span>
                        ) : (
                          <span className="rounded bg-muted/40 text-muted-foreground/50 px-1.5 py-0.2 text-[10px]">
                            {CAPABILITY_LABELS.monitoring}
                          </span>
                        )}
                        {resolved.capabilities.rollback ? (
                          <span className="inline-flex items-center gap-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium px-1.5 py-0.2 text-[10px] border border-indigo-500/20">
                            <Check className="size-2.5" />
                            <span>{CAPABILITY_LABELS.rollback}</span>
                          </span>
                        ) : (
                          <span className="rounded bg-muted/40 text-muted-foreground/50 px-1.5 py-0.2 text-[10px]">
                            {CAPABILITY_LABELS.rollback}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  {/* Row 3: Activity Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/20 px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {repoRollouts.length > 0 ? "Recent Rollouts" : "Recent Commits"}
                      </span>
                      {latestRollout && (
                        <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-semibold border border-emerald-500/20">
                          Latest: {latestRollout.status}
                        </span>
                      )}
                    </div>

                    {repoRollouts.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-3">
                        {repoRollouts.slice(0, 3).map((r) => (
                          <div key={r.id} className="flex items-center gap-1.5">
                            <Link
                              href={commitPageHref(repo.owner, repo.name, r.commitSha)}
                              className="font-mono text-[11px] font-semibold text-primary hover:underline"
                            >
                              {r.commitSha.slice(0, 7)}
                            </Link>
                            <span className="text-[10px] text-muted-foreground">
                              {dates.date(r.startedAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : recentCommits.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-3">
                        {recentCommits.map((commit) => (
                          <div key={commit.id} className="flex items-center gap-1.5">
                            <Link
                              href={commitPageHref(repo.owner, repo.name, commit.sha)}
                              className="font-mono text-[11px] font-semibold text-primary hover:underline"
                            >
                              {commit.sha.slice(0, 7)}
                            </Link>
                            {commit.threshold && (
                              <span className="rounded border border-primary/20 bg-primary/10 px-1 py-0.2 font-mono text-[9px] text-primary">
                                {(commit.threshold.finalThreshold * 100).toFixed(1)}% / {commit.threshold.finalWindow}s
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {dates.date(commit.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {activityError ? "Recent activity is unavailable." : "No activity recorded yet"}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* DETAILED VIEW: Structured 2-column Grid with Balanced Cards */
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {repos.map((repo) => {
              const repoConn = connectionFor(connections, repo.owner, repo.name);
              const resolved = resolveFromLegacy(repoConn || {});
              const mode = resolveRepoMode(repoConn);
              const repoRollouts = standaloneRollouts.filter(
                (r) =>
                  r.owner?.toLowerCase() === repo.owner.toLowerCase() &&
                  r.repo?.toLowerCase() === repo.name.toLowerCase()
              );
              const latestRollout = repoRollouts[0];
              const recentCommits = commits
                .filter((c) => repoIdentityKey(c.owner, c.repo) === repoIdentityKey(repo.owner, repo.name))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3);
              const derivedStatus = deriveRepoStatus({
                isConfigured: Boolean(repoConn),
                isVerified: Boolean(repoConn?.verifiedAt),
                hasPendingRollout: repoRollouts.some((r) => r.status === "PENDING"),
                latestOutcomeStatus: latestRollout?.status ?? null,
                totalRollouts: repoRollouts.length,
                mode,
              });
              const badge = getStatusBadgeVariant(derivedStatus);
              const cfg = (repoConn?.storedConfig ?? {}) as Record<string, unknown>;
              const pm2Target = typeof cfg.target === "string" ? cfg.target : undefined;
              const agentStatus = deriveAgentStatus({
                agentLastHeartbeat: repoConn?.agentLastHeartbeat,
                agentRevoked: repoConn?.agentRevoked,
                isVerified: Boolean(repoConn?.verifiedAt),
              });

              return (
                <article
                  key={repo.id}
                  className="flex min-w-0 flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs hover:border-border/80 transition-colors"
                >
                  <div className="space-y-4">
                    {/* Header: Title, Branch, and Architecture Type */}
                    <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
                          <p className="font-semibold text-sm text-foreground [overflow-wrap:anywhere]">
                            {repo.full_name}
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                          Branch <span className="font-mono text-foreground font-medium">{repo.default_branch}</span>
                        </p>
                      </div>

                      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 sm:justify-end">
                        <span className="max-w-full rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary [overflow-wrap:anywhere]">
                          {resolved.integrationLabel.toUpperCase()}
                        </span>
                        <span
                          className={`max-w-full rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider [overflow-wrap:anywhere] ${
                            resolved.runtimeStatus === "active"
                              ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                              : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {resolved.runtimeLabel.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Architecture Specification Grid */}
                    <dl className="grid grid-cols-1 gap-2.5 text-xs [overflow-wrap:anywhere] sm:grid-cols-2 [&>div]:min-w-0">
                      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {CARF_TERMS.deploymentIntegration.label}
                        </dt>
                        <dd className="mt-1 font-semibold text-foreground text-xs truncate">
                          {resolved.integrationLabel}
                        </dd>
                      </div>

                      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {CARF_TERMS.runtimeIntegration.label}
                        </dt>
                        <dd className="mt-1 font-semibold text-foreground text-xs flex items-center gap-1.5 truncate">
                          <span className="truncate">{resolved.runtimeLabel}</span>
                          {resolved.runtimeStatus === "active" && (
                            <span className="inline-block whitespace-nowrap text-[10px] text-emerald-500 font-bold">● Active</span>
                          )}
                        </dd>
                      </div>

                      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        {resolved.requiresAgent ? (
                          <>
                            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Host Agent
                            </dt>
                            <dd className="mt-1 font-semibold text-foreground text-xs">
                              {agentStatus === "online" || agentStatus === "colocated"
                                ? "Connected"
                                : agentStatus === "offline"
                                  ? "Offline"
                                  : agentStatus === "revoked"
                                    ? "Revoked"
                                    : "Not installed"}
                            </dd>
                          </>
                        ) : (
                          <>
                            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Agent Footprint
                            </dt>
                            <dd className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                              Zero Agent
                            </dd>
                          </>
                        )}
                      </div>

                      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Runtime Status
                        </dt>
                        <dd className={`mt-1 font-semibold text-xs flex items-center gap-1.5 ${badge.colorClass.split(" ")[1] ?? "text-foreground"}`}>
                          <span className={`size-1.5 rounded-full ${badge.dotClass}`} />
                          <span className="truncate">{derivedStatus}</span>
                        </dd>
                      </div>

                      {pm2Target && (
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 sm:col-span-1">
                          <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {CARF_TERMS.deploymentTarget.label}
                          </dt>
                          <dd className="mt-1 font-mono font-semibold text-foreground text-xs truncate">
                            {pm2Target}
                          </dd>
                        </div>
                      )}

                      {resolved.capabilities.rollback && (
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 sm:col-span-1">
                          <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Rollouts / Rollbacks
                          </dt>
                          <dd className="mt-1 font-semibold text-foreground text-xs">
                            {repoRollouts.length} / {repoRollouts.filter((r) => r.status === "ROLLED_BACK").length}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {/* Available Capabilities Row */}
                    <div className="rounded-lg border border-border/50 bg-muted/10 p-2.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-foreground text-[10px] uppercase tracking-wider mr-0.5">
                          Available Capabilities:
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium px-2 py-0.5 text-[11px] border border-emerald-500/20">
                          <Check className="size-3" />
                          <span>{CAPABILITY_LABELS.policy}</span>
                        </span>
                        {resolved.capabilities.monitoring ? (
                          <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 font-medium px-2 py-0.5 text-[11px] border border-sky-500/20">
                            <Check className="size-3" />
                            <span>{CAPABILITY_LABELS.monitoring}</span>
                          </span>
                        ) : (
                          <span className="rounded bg-muted/40 text-muted-foreground/60 px-2 py-0.5 text-[11px] border border-border/50">
                            {CAPABILITY_LABELS.monitoring}
                          </span>
                        )}
                        {resolved.capabilities.rollback ? (
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium px-2 py-0.5 text-[11px] border border-indigo-500/20">
                            <Check className="size-3" />
                            <span>{CAPABILITY_LABELS.rollback}</span>
                          </span>
                        ) : (
                          <span className="rounded bg-muted/40 text-muted-foreground/60 px-2 py-0.5 text-[11px] border border-border/50">
                            {CAPABILITY_LABELS.rollback}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Recent Activity Section */}
                    <div className="border-t border-border pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground mb-1.5">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">
                          {repoRollouts.length > 0 ? "Recent Rollouts" : "Recent Commits"}
                        </span>
                        {latestRollout && <span className="text-[11px]">Latest: {latestRollout.status}</span>}
                      </div>

                      {repoRollouts.length > 0 ? (
                        <ul className="space-y-1.5">
                          {repoRollouts.slice(0, 3).map((r) => (
                            <li
                              key={r.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <Link
                                  href={commitPageHref(repo.owner, repo.name, r.commitSha)}
                                  className="font-mono text-[11px] font-semibold text-primary hover:underline"
                                >
                                  {r.commitSha.slice(0, 7)}
                                </Link>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    r.status === "SUCCESS"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : r.status === "ROLLED_BACK"
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                        : r.status === "PENDING"
                                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                          : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {dates.date(r.startedAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : recentCommits.length > 0 ? (
                        <ul className="space-y-1.5">
                          {recentCommits.map((commit) => (
                            <li
                              key={commit.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <Link
                                  href={commitPageHref(repo.owner, repo.name, commit.sha)}
                                  className="font-mono text-[11px] font-semibold text-primary hover:underline"
                                >
                                  {commit.sha.slice(0, 7)}
                                </Link>
                                {commit.threshold && (
                                  <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.2 font-mono text-[10px] text-primary">
                                    {(commit.threshold.finalThreshold * 100).toFixed(1)}% / {commit.threshold.finalWindow}s
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {dates.date(commit.createdAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground py-1">
                          {activityError ? "Recent activity is unavailable." : "No activity recorded yet"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <Link
                      href={`/dashboard/repos/${repo.owner}/${repo.name}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      <span>View details</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
