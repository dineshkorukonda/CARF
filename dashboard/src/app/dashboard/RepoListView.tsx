"use client";

import { useDashboardDates } from "../../lib/useDashboardDates";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Terminal,
  Activity,
  RotateCcw,
  Clock,
  ArrowRight,
  PlugZap,
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
import { commitPageHref } from "../../lib/dashboardNav";
import { RolloutOutcomeChart, type OutcomeDayBucket } from "./RolloutOutcomeChart";
import { Button } from "../../components/ui/button";

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
  deploymentIntegration?: string | null;
  runtimeAdapter?: string | null;
  verifiedAt: Date | string | null;
  monitoringPaused: boolean;
  storedConfig?: unknown;
  agentLastHeartbeat?: Date | string | null;
  agentRevoked?: boolean | null;
  installTokenHash?: string | null;
}

interface RolloutOutcomeItem {
  id: string;
  commitSha: string;
  owner: string | null;
  repo: string | null;
  status: "PENDING" | "SUCCESS" | "ROLLED_BACK" | "FAILED";
  threshold: number;
  window: number;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  rolledBack: boolean;
  reason: string | null;
}

interface CommitItem {
  id: string;
  sha: string;
  owner: string;
  repo: string;
  createdAt: Date | string;
}

interface RepoListViewProps {
  repos: RepoItem[];
  connections: RepoConnectionItem[];
  rollouts: RolloutOutcomeItem[];
  commits: CommitItem[];
  activityError?: string | null;
}

function connectionFor(connections: RepoConnectionItem[], owner: string, repo: string) {
  return connections.find(
    (c) => c.owner.toLowerCase() === owner.toLowerCase() && c.repo.toLowerCase() === repo.toLowerCase()
  );
}

export function RepoListView({
  repos,
  connections,
  rollouts,
  commits,
  activityError,
}: RepoListViewProps) {
  const dates = useDashboardDates();
  const standaloneKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of connections) {
      if (resolveRepoMode(c) === "standalone") keys.add(repoIdentityKey(c.owner, c.repo));
    }
    return keys;
  }, [connections]);

  const standaloneRollouts = useMemo(
    () =>
      rollouts.filter((r) =>
        r.owner && r.repo ? standaloneKeys.has(repoIdentityKey(r.owner, r.repo)) : false
      ),
    [rollouts, standaloneKeys]
  );

  const totalCommits = commits.length;
  const totalRollouts = standaloneRollouts.length;
  const rolledBackCount = standaloneRollouts.filter((r) => r.status === "ROLLED_BACK").length;
  const activePendingCount = standaloneRollouts.filter((r) => r.status === "PENDING").length;

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
  }, [standaloneRollouts, dates]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Repositories</h1>
          <p className="mt-1 text-xs text-muted-foreground">
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

      {activityError ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground" role="status">
          {activityError}
        </p>
      ) : null}

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
            <span className="text-xs text-muted-foreground">
              {totalRollouts > 0 ? `of ${totalRollouts} rollouts` : "automated"}
            </span>
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

      {standaloneRollouts.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Rollout Outcomes (last 14 days)</h2>
              <p className="text-[11px] text-muted-foreground">
                Runtime observation verdicts and rollback history across monitored applications.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <RolloutOutcomeChart data={chartData} />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Connected Repositories ({repos.length})</h2>
          <p className="text-[11px] text-muted-foreground">
            Repositories with active CARF Core policies and deployment integrations.
          </p>
        </div>

        {repos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <FolderGit2 className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-2 text-xs font-semibold text-foreground">No connected repositories</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a repository to configure deployment integration and runtime adapters.
            </p>
            <Link
              href="/dashboard/setup"
              className="mt-4 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Add Repository
            </Link>
          </div>
        ) : (
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
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{repo.full_name}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Branch <span className="font-mono text-foreground">{repo.default_branch}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
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
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Deployment</dt>
                        <dd className="font-semibold text-foreground">{resolved.integrationLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Runtime</dt>
                        <dd className="font-semibold text-foreground">
                          {resolved.runtimeLabel}
                          {resolved.runtimeStatus === "active" && (
                            <span className="ml-1 text-[10px] text-emerald-500 font-bold">● Active</span>
                          )}
                        </dd>
                      </div>
                      {resolved.requiresAgent ? (
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Host Agent</dt>
                          <dd className="font-semibold text-foreground">
                            {agentStatus === "online" || agentStatus === "colocated"
                              ? "Connected"
                              : agentStatus === "offline"
                                ? "Offline"
                                : agentStatus === "revoked"
                                  ? "Revoked"
                                  : "Not installed"}
                          </dd>
                        </div>
                      ) : (
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Agent Footprint</dt>
                          <dd className="font-semibold text-emerald-600 dark:text-emerald-400">Zero Agent</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</dt>
                        <dd className={`font-semibold ${badge.colorClass.split(" ")[1] ?? "text-foreground"}`}>
                          {derivedStatus}
                        </dd>
                      </div>
                      {pm2Target && (
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Target</dt>
                          <dd className="font-mono font-semibold text-foreground">{pm2Target}</dd>
                        </div>
                      )}
                      {resolved.capabilities.rollback && (
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Rollouts / Rollbacks</dt>
                          <dd className="font-semibold text-foreground">
                            {repoRollouts.length} / {repoRollouts.filter((r) => r.status === "ROLLED_BACK").length}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <div className="border-t border-border pt-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-foreground">Capabilities:</span>
                        <span className="rounded bg-muted/60 px-1.5 py-0.5">Policy & Risk</span>
                        <span className="rounded bg-muted/60 px-1.5 py-0.5">Dynamic Thresholds</span>
                        {resolved.capabilities.rollback && (
                          <span className="rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 px-1.5 py-0.5">
                            Automated Rollback
                          </span>
                        )}
                      </div>
                    </div>

                    {repoRollouts.length > 0 && (
                      <div className="border-t border-border pt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-semibold uppercase tracking-wider text-[11px]">Recent Rollouts</span>
                          <span className="text-[11px]">Latest: {latestRollout?.status ?? "None"}</span>
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {repoRollouts.slice(0, 3).map((r) => (
                            <li
                              key={r.id}
                              className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <Link
                                  href={commitPageHref(repo.owner, repo.name, r.commitSha)}
                                  className="font-mono text-[11px] text-primary hover:underline"
                                >
                                  {r.commitSha.slice(0, 7)}
                                </Link>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    r.status === "SUCCESS"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                      : r.status === "ROLLED_BACK"
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                        : r.status === "PENDING"
                                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
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
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <Link
                      href={`/dashboard/repos/${repo.owner}/${repo.name}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
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
