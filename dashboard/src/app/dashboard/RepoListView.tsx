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
  Sliders,
} from "lucide-react";
import { deriveRepoStatus, getStatusBadgeVariant } from "../../lib/repoStatusDerivation";
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
  verifiedAt: Date | string | null;
  monitoringPaused: boolean;
  storedConfig?: unknown;
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

export function RepoListView({
  repos,
  connections,
  rollouts,
  commits,
  activityError,
}: RepoListViewProps) {
  // Metrics
  const totalCommits = commits.length;
  const totalRollouts = rollouts.length;
  const rolledBackCount = rollouts.filter((r) => r.status === "ROLLED_BACK").length;
  const activePendingCount = rollouts.filter((r) => r.status === "PENDING").length;

  // Chart data: rollouts by day over last 14 days
  const chartData = useMemo(() => {
    const buckets: Record<string, OutcomeDayBucket> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0]!;
      buckets[key] = {
        date: key.slice(5), // MM-DD
        SUCCESS: 0,
        ROLLED_BACK: 0,
        FAILED: 0,
        PENDING: 0,
        total: 0,
      };
    }

    rollouts.forEach((r) => {
      const dateKey = new Date(r.startedAt).toISOString().split("T")[0]!;
      if (buckets[dateKey]) {
        buckets[dateKey][r.status] = (buckets[dateKey][r.status] || 0) + 1;
        buckets[dateKey].total += 1;
      }
    });

    return Object.values(buckets);
  }, [rollouts]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Repositories & Rollout Overview</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Monitor real-time error-rate observations, PM2 standalone process targets, and automated rollback verdicts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/setup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            <Terminal className="size-3.5" />
            <span>Connect PM2 Target</span>
          </Link>
        </div>
      </div>

      {activityError ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground" role="status">
          {activityError}
        </p>
      ) : null}

      {/* Metric Cards with Denominators */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Commits Analyzed */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Commits Analyzed</span>
            <Activity className="size-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalCommits}</span>
            <span className="text-xs text-muted-foreground">commits recorded</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Source: Webhook commit intake</p>
        </div>

        {/* Metric 2: Rollouts Monitored */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Rollouts Monitored</span>
            <Terminal className="size-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalRollouts}</span>
            <span className="text-xs text-muted-foreground">
              {totalCommits > 0 ? `of ${totalCommits} commits` : "rollouts"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Source: Standalone RolloutOutcome rows</p>
        </div>

        {/* Metric 3: Rollbacks Executed */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Rollbacks Executed</span>
            <RotateCcw className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{rolledBackCount}</span>
            <span className="text-xs text-muted-foreground">
              {totalRollouts > 0 ? `of ${totalRollouts} rollouts` : "rollbacks"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Triggered on error-rate threshold breach</p>
        </div>

        {/* Metric 4: Active Observation Loops */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Active Observation</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{activePendingCount}</span>
            {activePendingCount > 0 ? (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 animate-pulse">
                Observing
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">idle</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {activePendingCount > 0 ? "Observation loops in progress" : "No active rollout observation windows"}
          </p>
        </div>
      </div>

      {/* Rollout Outcomes Over Time Chart */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Rollouts by Outcome (Last 14 Days)</h2>
            <p className="text-[11px] text-muted-foreground">
              Recorded rollout observation verdicts grouped by day across all repositories.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <RolloutOutcomeChart data={chartData} />
        </div>
      </div>

      {/* Connected Repositories List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Repositories ({repos.length})</h2>

        {repos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <FolderGit2 className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-2 text-xs font-semibold text-foreground">No repositories found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Install the GitHub App or grant access to repositories in Settings.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            {repos.map((repo) => {
              const repoRollouts = rollouts.filter(
                (r) =>
                  r.owner?.toLowerCase() === repo.owner.toLowerCase() &&
                  r.repo?.toLowerCase() === repo.name.toLowerCase()
              );
              const repoConn = connections.find(
                (c) =>
                  c.owner.toLowerCase() === repo.owner.toLowerCase() &&
                  c.repo.toLowerCase() === repo.name.toLowerCase()
              );

              const latestRollout = repoRollouts[0];
              const derivedStatus = deriveRepoStatus({
                isConfigured: Boolean(repoConn?.storedConfig),
                isVerified: Boolean(repoConn?.verifiedAt),
                hasPendingRollout: repoRollouts.some((r) => r.status === "PENDING"),
                latestOutcomeStatus: latestRollout?.status ?? null,
                totalRollouts: repoRollouts.length,
              });

              const badge = getStatusBadgeVariant(derivedStatus);
              const repoRollbacks = repoRollouts.filter((r) => r.status === "ROLLED_BACK").length;

              return (
                <div
                  key={repo.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                      <FolderGit2 className="size-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/repos/${repo.owner}/${repo.name}`}
                          className="font-semibold text-sm text-foreground hover:underline"
                        >
                          {repo.full_name}
                        </Link>
                        <span className="rounded border border-border bg-muted/40 px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                          {repo.default_branch}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.colorClass}`}
                        >
                          <span className={`size-1.5 rounded-full ${badge.dotClass}`} />
                          {derivedStatus}
                        </span>
                        {repoConn?.monitoringPaused && (
                          <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            Monitoring Paused
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{repoRollouts.length} rollouts</span>
                        <span>•</span>
                        <span>{repoRollbacks} rollbacks</span>
                        <span>•</span>
                        <span>
                          {repoConn?.verifiedAt
                            ? `Connection verified: ${new Date(repoConn.verifiedAt).toLocaleDateString()}`
                            : "Connection not verified"}
                        </span>
                        {latestRollout && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[11px]">
                              Latest: {latestRollout.commitSha.slice(0, 7)} ({latestRollout.status})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dashboard/repos/${repo.owner}/${repo.name}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
                    >
                      <span>Inspect Rollouts</span>
                      <ArrowRight className="size-3" />
                    </Link>
                    <Link
                      href="/dashboard/setup"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Sliders className="size-3" />
                      <span>Setup</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
