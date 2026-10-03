"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Terminal,
  Activity,
  RotateCcw,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  deriveRepoStatus,
  getStatusBadgeVariant,
  deriveAgentStatus,
} from "../../lib/repoStatusDerivation";
import {
  resolveRepoMode,
  resolveAugmentIntegration,
  augmentIntegrationLabel,
  repoIdentityKey,
} from "../../lib/deploymentMode";
import { commitPageHref } from "../../lib/dashboardNav";
import { RolloutOutcomeChart, type OutcomeDayBucket } from "./RolloutOutcomeChart";

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
  const augmentRepoCount = connections.filter((c) => resolveRepoMode(c) === "augment").length;

  const chartData = useMemo(() => {
    const buckets: Record<string, OutcomeDayBucket> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0]!;
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
      const dateKey = new Date(r.startedAt).toISOString().split("T")[0]!;
      if (buckets[dateKey]) {
        buckets[dateKey][r.status] = (buckets[dateKey][r.status] || 0) + 1;
        buckets[dateKey].total += 1;
      }
    });

    return Object.values(buckets);
  }, [standaloneRollouts]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Repositories</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            CARF supports two deployment modes: Standalone (PM2 + Host Agent) and Augment (external CD + CARF policy).
          </p>
        </div>
        <Link
          href="/dashboard/setup"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Add Repository
        </Link>
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
          <p className="mt-1 text-[11px] text-muted-foreground">Shared classification intake for both modes</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Standalone Rollouts</span>
            <Terminal className="size-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalRollouts}</span>
            <span className="text-xs text-muted-foreground">monitored</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Standalone RolloutOutcome rows only</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Rollbacks Executed</span>
            <RotateCcw className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{rolledBackCount}</span>
            <span className="text-xs text-muted-foreground">
              {totalRollouts > 0 ? `of ${totalRollouts} rollouts` : "standalone"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Standalone threshold-breach rollbacks</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Active Observation</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{activePendingCount}</span>
            {augmentRepoCount > 0 ? (
              <span className="text-xs text-muted-foreground">{augmentRepoCount} augment</span>
            ) : (
              <span className="text-xs text-muted-foreground">idle</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {activePendingCount > 0
              ? "Standalone observation loops in progress"
              : "No active standalone observation windows"}
          </p>
        </div>
      </div>

      {standaloneRollouts.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Standalone rollouts (last 14 days)</h2>
              <p className="text-[11px] text-muted-foreground">
                Observation verdicts for Standalone repositories only. Augment repos do not create rollout rows.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <RolloutOutcomeChart data={chartData} />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Connected repositories ({repos.length})</h2>

        {repos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <FolderGit2 className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-2 text-xs font-semibold text-foreground">No connected repositories</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a repository, then choose Standalone or Augment. GitHub App access alone is not enough.
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
                      <span
                        className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                          mode === "augment"
                            ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                            : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                        }`}
                      >
                        {mode === "augment" ? "AUGMENT" : "STANDALONE"}
                      </span>
                    </div>

                    {mode === "standalone" ? (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Runtime</dt>
                          <dd className="font-semibold text-foreground">PM2</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Target</dt>
                          <dd className="font-mono font-semibold text-foreground">{pm2Target || "—"}</dd>
                        </div>
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
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</dt>
                          <dd className={`font-semibold ${badge.colorClass.split(" ")[1] ?? "text-foreground"}`}>
                            {derivedStatus}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Rollouts</dt>
                          <dd className="font-semibold text-foreground">{repoRollouts.length}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Rollbacks</dt>
                          <dd className="font-semibold text-foreground">
                            {repoRollouts.filter((r) => r.status === "ROLLED_BACK").length}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Integration</dt>
                          <dd className="font-semibold text-foreground">
                            {augmentIntegrationLabel(resolveAugmentIntegration(repoConn))}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Policy</dt>
                          <dd className="font-semibold text-foreground">{derivedStatus}</dd>
                        </div>
                      </dl>
                    )}

                    {mode === "standalone" && latestRollout ? (
                      <Link
                        href={commitPageHref(repo.owner, repo.name, latestRollout.commitSha)}
                        className="font-mono text-[11px] text-muted-foreground hover:underline"
                      >
                        Latest: {latestRollout.commitSha.slice(0, 7)} ({latestRollout.status})
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-end">
                    <Link
                      href={`/dashboard/repos/${repo.owner}/${repo.name}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
                    >
                      <span>Open Project</span>
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
