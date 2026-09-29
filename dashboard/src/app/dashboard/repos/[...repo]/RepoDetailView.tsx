"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Terminal,
  RotateCcw,
  Clock,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { deriveRepoStatus, getStatusBadgeVariant } from "../../../../lib/repoStatusDerivation";
import { useLiveRolloutPolling } from "../../../../lib/useLiveRolloutPolling";
import { repoSetupHref } from "../../../../lib/dashboardNav";

interface SampleItem {
  id: string;
  ts: Date | string;
  errorRate: number;
}

export interface RolloutItem {
  id: string;
  commitSha: string;
  status: "PENDING" | "SUCCESS" | "ROLLED_BACK" | "FAILED";
  threshold: number;
  window: number;
  startedAt: Date | string;
  finishedAt: Date | string | null;
  rolledBack: boolean;
  reason: string | null;
  rollbackVerified: boolean | null;
  samples?: SampleItem[];
}

export interface ChangeVectorItem {
  infra: number;
  dependency: number;
  config: number;
  code: number;
  codeComplexity: number;
}

export interface ThresholdItem {
  finalThreshold: number;
  finalWindow: number;
  activeTypes: string[];
}

export interface CommitWithDetails {
  id: string;
  sha: string;
  baseSha: string;
  createdAt: Date | string;
  changeVector?: ChangeVectorItem | null;
  threshold?: ThresholdItem | null;
}

export interface AuditLogItem {
  id: string;
  actor: string;
  action: string;
  result: string;
  details?: unknown;
  ts: Date | string;
}

interface RepoDetailViewProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  installationId: string;
  connection?: {
    id: string;
    verifiedAt: Date | string | null;
    monitoringPaused: boolean;
    storedConfig?: unknown;
  } | null;
  rollouts: RolloutItem[];
  commits: CommitWithDetails[];
  auditLogs: AuditLogItem[];
  activityError?: string | null;
}

export function RepoDetailView({
  owner,
  repo,
  defaultBranch,
  installationId,
  connection,
  rollouts,
  commits,
  auditLogs,
  activityError,
}: RepoDetailViewProps) {
  const [monitoringPaused, setMonitoringPaused] = useState<boolean>(
    connection?.monitoringPaused ?? false
  );
  const [togglingPause, setTogglingPause] = useState<boolean>(false);

  const {
    rollouts: liveRollouts,
    setRollouts: setLiveRollouts,
    isPolling,
    pendingRollout,
    countdownSeconds,
  } = useLiveRolloutPolling(rollouts, installationId);

  // Filters
  const [outcomeFilter, setOutcomeFilter] = useState<string>("ALL");
  const [expandedCommitSha, setExpandedCommitSha] = useState<string | null>(null);

  // Selected rollout for Graph 1
  const [selectedRolloutId, setSelectedRolloutId] = useState<string>(
    liveRollouts[0]?.id || ""
  );

  // Manual Rollback Modal State
  const [rollbackTarget, setRollbackTarget] = useState<RolloutItem | null>(null);
  const [rollingBack, setRollingBack] = useState<boolean>(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [rollbackSuccess, setRollbackSuccess] = useState<string | null>(null);

  const selectedRollout = liveRollouts.find((r) => r.id === selectedRolloutId) || liveRollouts[0];

  // Derived repo status
  const derivedStatus = deriveRepoStatus({
    isConfigured: Boolean(connection?.storedConfig),
    isVerified: Boolean(connection?.verifiedAt),
    hasPendingRollout: liveRollouts.some((r) => r.status === "PENDING"),
    latestOutcomeStatus: liveRollouts[0]?.status ?? null,
    totalRollouts: liveRollouts.length,
  });

  const badge = getStatusBadgeVariant(derivedStatus);

  // Toggle monitoring pause
  const togglePause = async () => {
    setTogglingPause(true);
    try {
      const nextPaused = !monitoringPaused;
      const res = await fetch("/api/repo/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          owner,
          repo,
          paused: nextPaused,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setMonitoringPaused(nextPaused);
    } catch (err: unknown) {
      alert(`Failed to update pause state: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setTogglingPause(false);
    }
  };

  // Execute manual rollback
  const executeRollback = async () => {
    if (!rollbackTarget) return;
    setRollingBack(true);
    setRollbackError(null);
    setRollbackSuccess(null);

    try {
      const res = await fetch(
        `/api/rollouts/${encodeURIComponent(rollbackTarget.id)}/rollback?installationId=${encodeURIComponent(
          installationId
        )}`,
        { method: "POST" }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setRollbackSuccess(
        `Rollback initiated successfully for ${rollbackTarget.commitSha.slice(0, 7)}.`
      );
      // Update local status immutably
      setLiveRollouts((prev) =>
        prev.map((r) =>
          r.id === rollbackTarget.id
            ? { ...r, status: "ROLLED_BACK", rolledBack: true, reason: "manual" }
            : r
        )
      );
      setTimeout(() => {
        setRollbackTarget(null);
      }, 1500);
    } catch (err: unknown) {
      setRollbackError(err instanceof Error ? err.message : "Manual rollback failed");
    } finally {
      setRollingBack(false);
    }
  };

  // --- Graph 1 Data: Error Rate vs Threshold Over Time ---
  const graph1Data = useMemo(() => {
    if (!selectedRollout || !selectedRollout.samples || selectedRollout.samples.length === 0) {
      return [];
    }
    const thresholdPct = Number((selectedRollout.threshold * 100).toFixed(2));
    return selectedRollout.samples.map((s, idx) => {
      const t = new Date(s.ts);
      const timeLabel = `${t.getHours().toString().padStart(2, "0")}:${t
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${t.getSeconds().toString().padStart(2, "0")}`;
      return {
        sampleIndex: idx + 1,
        time: timeLabel,
        errorRate: Number((s.errorRate * 100).toFixed(2)),
        threshold: thresholdPct,
      };
    });
  }, [selectedRollout]);

  // --- Graph 2 Data: Threshold & Window per Commit ---
  const graph2Data = useMemo(() => {
    return commits.slice(0, 20).map((c) => {
      const t = c.threshold;
      return {
        sha: c.sha.slice(0, 7),
        threshold: t ? Number((t.finalThreshold * 100).toFixed(1)) : 5,
        window: t ? t.finalWindow : 300,
        type: t?.activeTypes?.[0] || "code",
      };
    }).reverse();
  }, [commits]);

  // --- Graph 3 Data: Change-Vector Breakdown per Commit ---
  const graph3Data = useMemo(() => {
    return commits.slice(0, 15).map((c) => {
      const cv = c.changeVector;
      return {
        sha: c.sha.slice(0, 7),
        infra: cv ? Number(cv.infra.toFixed(2)) : 0,
        dependency: cv ? Number(cv.dependency.toFixed(2)) : 0,
        config: cv ? Number(cv.config.toFixed(2)) : 0,
        code: cv ? Number(cv.code.toFixed(2)) : 0,
        complexity: cv ? Number(cv.codeComplexity.toFixed(2)) : 0,
      };
    }).reverse();
  }, [commits]);

  // --- Graph 4 Data: Time to Verdict & Rollback Distribution ---
  const graph4Data = useMemo(() => {
    return liveRollouts
      .filter((r) => r.finishedAt != null)
      .slice(0, 15)
      .map((r) => {
        const durationSec = Math.max(
          1,
          Math.floor((new Date(r.finishedAt!).getTime() - new Date(r.startedAt).getTime()) / 1000)
        );
        return {
          sha: r.commitSha.slice(0, 7),
          durationSeconds: durationSec,
          outcome: r.status,
          isRollback: r.status === "ROLLED_BACK",
        };
      }).reverse();
  }, [liveRollouts]);

  // Filtered commits
  const filteredCommits = useMemo(() => {
    return commits.filter((c) => {
      const matchingRollout = liveRollouts.find((r) => r.commitSha === c.sha);
      if (outcomeFilter === "ALL") return true;
      if (outcomeFilter === "NONE") return !matchingRollout;
      return matchingRollout?.status === outcomeFilter;
    });
  }, [commits, liveRollouts, outcomeFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Back Link */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Repositories</span>
        </Link>
      </div>

      {activityError ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground" role="status">
          {activityError}
        </p>
      ) : null}

      {/* Repository Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
            <FolderGit2 className="size-5 text-primary" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {owner}/{repo}
              </h1>
              <span className="rounded border border-border bg-muted/40 px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                {defaultBranch}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.colorClass}`}
              >
                <span className={`size-1.5 rounded-full ${badge.dotClass}`} />
                {derivedStatus}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {connection?.verifiedAt
                ? `Connection verified: ${new Date(connection.verifiedAt).toLocaleString()}`
                : "Connection unverified — run connection check in Setup"}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePause}
            disabled={togglingPause}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors ${
              monitoringPaused
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {togglingPause ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : monitoringPaused ? (
              <Play className="size-3.5" />
            ) : (
              <Pause className="size-3.5" />
            )}
            <span>{monitoringPaused ? "Resume Monitoring" : "Pause Monitoring"}</span>
          </button>
          <Link
            href={repoSetupHref(owner, repo)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Terminal className="size-3.5" />
            <span>Setup & Config</span>
          </Link>
        </div>
      </div>

      {/* Paused Alert Banner */}
      {monitoringPaused && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Observation Monitoring Paused</p>
            <p className="mt-0.5 text-amber-600 dark:text-amber-300">
              New commits arriving via webhook will not start standalone observation loops or automated rollbacks. Existing rollout history is preserved.
            </p>
          </div>
        </div>
      )}

      {/* Live Polling Banner */}
      {isPolling && pendingRollout && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="size-4 animate-spin text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-semibold">Observation In Progress for commit {pendingRollout.commitSha.slice(0, 7)}:</span>
              <span className="ml-1 text-amber-600 dark:text-amber-300">
                Window expires in {countdownSeconds ?? pendingRollout.window}s. Polling error-rate telemetry live every 3s.
              </span>
            </div>
          </div>
          <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-300 animate-pulse">
            LIVE POLLING
          </span>
        </div>
      )}

      {/* ── 4 Recharts Analytics Graphs ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Graph 1: Error Rate vs Threshold Over Time */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Error Rate vs. Threshold Over Time</h2>
              <p className="text-[11px] text-muted-foreground">
                High-resolution telemetry samples recorded during observation window.
              </p>
            </div>
            {liveRollouts.length > 0 && (
              <select
                value={selectedRolloutId}
                onChange={(e) => setSelectedRolloutId(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground focus:outline-none"
              >
                {liveRollouts.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.commitSha.slice(0, 7)} ({r.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-4">
            {graph1Data.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center p-6">
                <Clock className="size-6 text-muted-foreground/60" />
                <p className="mt-2 text-xs font-semibold text-foreground">No telemetry samples recorded</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Intermediate poll samples appear here while a rollout is being monitored.
                </p>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graph1Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={10} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      unit="%"
                      domain={[0, (dataMax: number) => Math.max(dataMax + 1, (selectedRollout?.threshold ?? 0.05) * 100 + 1)]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "0.5rem",
                        fontSize: "11px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <ReferenceLine
                      y={Number(((selectedRollout?.threshold ?? 0.05) * 100).toFixed(2))}
                      label={{ value: "Threshold Ceiling", fill: "#f43f5e", fontSize: 10 }}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="errorRate"
                      name="Observed Error Rate (%)"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Graph 2: Threshold and Window per Commit */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">Threshold & Window per Commit</h2>
            <p className="text-[11px] text-muted-foreground">
              Calibrated error-rate ceiling (%) and observation window (seconds) across recent commits.
            </p>
          </div>

          <div className="mt-4">
            {graph2Data.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center p-6">
                <Info className="size-6 text-muted-foreground/60" />
                <p className="mt-2 text-xs font-semibold text-foreground">No commit thresholds recorded</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Thresholds will be calculated upon webhook commit delivery.
                </p>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graph2Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="sha" tickLine={false} axisLine={false} fontSize={10} fontStyle="monospace" />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={10} unit="%" />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={10} unit="s" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "0.5rem",
                        fontSize: "11px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar yAxisId="left" dataKey="threshold" name="Threshold (%)" fill="#6366f1" radius={[2, 2, 0, 0]} />
                    <Bar yAxisId="right" dataKey="window" name="Window (s)" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Graph 3: Change-Vector Breakdown per Commit */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">Change-Vector Breakdown per Commit</h2>
            <p className="text-[11px] text-muted-foreground">
              Semantic breakdown of AST change factors (infra, dependency, config, code, complexity).
            </p>
          </div>

          <div className="mt-4">
            {graph3Data.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center p-6">
                <Info className="size-6 text-muted-foreground/60" />
                <p className="mt-2 text-xs font-semibold text-foreground">No change vectors recorded</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  AST classifications will appear once commits are analyzed.
                </p>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graph3Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="sha" tickLine={false} axisLine={false} fontSize={10} fontStyle="monospace" />
                    <YAxis tickLine={false} axisLine={false} fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "0.5rem",
                        fontSize: "11px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="infra" name="Infra" stackId="a" fill="#8b5cf6" />
                    <Bar dataKey="dependency" name="Dep" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="config" name="Config" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="code" name="Code" stackId="a" fill="#10b981" />
                    <Bar dataKey="complexity" name="Complexity" stackId="a" fill="#ec4899" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Graph 4: Time to Verdict & Rollback Distribution */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">Time to Verdict Distribution</h2>
            <p className="text-[11px] text-muted-foreground">
              Total observation time (seconds) to terminal outcome (Success vs. Rolled Back).
            </p>
          </div>

          <div className="mt-4">
            {graph4Data.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center p-6">
                <Clock className="size-6 text-muted-foreground/60" />
                <p className="mt-2 text-xs font-semibold text-foreground">No terminal rollouts recorded</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Completed observation loops will display elapsed duration here.
                </p>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graph4Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="sha" tickLine={false} axisLine={false} fontSize={10} fontStyle="monospace" />
                    <YAxis tickLine={false} axisLine={false} fontSize={10} unit="s" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "0.5rem",
                        fontSize: "11px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="durationSeconds" name="Duration (s)" fill="#10b981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Commits & Rollouts Section ── */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Commits & Rollout Lifecycle ({filteredCommits.length})</h2>
            <p className="text-[11px] text-muted-foreground">
              Expand rows to inspect change vectors, live error rates, and manual rollback triggers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filter by outcome:</span>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="ROLLED_BACK">Rolled Back</option>
              <option value="FAILED">Adapter Error</option>
              <option value="PENDING">Observing</option>
            </select>
          </div>
        </div>

        {filteredCommits.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No commits match the selected outcome filter.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredCommits.map((c) => {
              const rollout = rollouts.find((r) => r.commitSha === c.sha);
              const isExpanded = expandedCommitSha === c.sha;

              return (
                <div key={c.id} className="transition-colors hover:bg-muted/10">
                  <div
                    onClick={() => setExpandedCommitSha(isExpanded ? null : c.sha)}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Toggle details"
                      >
                        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">{c.sha.slice(0, 7)}</span>
                          {c.threshold?.activeTypes?.[0] && (
                            <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                              {c.threshold.activeTypes[0]}
                            </span>
                          )}
                          {rollout ? (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                rollout.status === "SUCCESS"
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                  : rollout.status === "ROLLED_BACK"
                                  ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                                  : rollout.status === "PENDING"
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse"
                                  : "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400"
                              }`}
                            >
                              {rollout.status === "PENDING"
                                ? "Observing"
                                : rollout.status === "SUCCESS"
                                ? "Success"
                                : rollout.status === "ROLLED_BACK"
                                ? "Rolled Back"
                                : "Adapter Error"}
                            </span>
                          ) : (
                            <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              No Rollout
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                          <span>Base: {c.baseSha.slice(0, 7)}</span>
                          <span>•</span>
                          <span>{new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground">Threshold:</span>
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {c.threshold ? `${(c.threshold.finalThreshold * 100).toFixed(1)}% / ${c.threshold.finalWindow}s` : "Default"}
                        </div>
                      </div>

                      {rollout && rollout.status !== "ROLLED_BACK" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRollbackTarget(rollout);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                        >
                          <RotateCcw className="size-3" />
                          <span>Rollback</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 p-4 text-xs space-y-3">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="rounded border border-border bg-card p-3">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Change Vectors</span>
                          <div className="mt-1 font-mono text-[11px] space-y-0.5 text-foreground">
                            <div>Infra: {c.changeVector?.infra.toFixed(2) ?? "0.00"}</div>
                            <div>Dep: {c.changeVector?.dependency.toFixed(2) ?? "0.00"}</div>
                            <div>Config: {c.changeVector?.config.toFixed(2) ?? "0.00"}</div>
                            <div>Code: {c.changeVector?.code.toFixed(2) ?? "0.00"}</div>
                          </div>
                        </div>

                        <div className="rounded border border-border bg-card p-3">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Rollout Verdict</span>
                          <div className="mt-1 font-mono text-[11px] space-y-0.5 text-foreground">
                            <div>Status: {rollout?.status || "None"}</div>
                            <div>Rolled Back: {rollout?.rolledBack ? "Yes" : "No"}</div>
                            <div>Reason: {rollout?.reason || "N/A"}</div>
                            <div>Verified: {rollout?.rollbackVerified ? "Yes" : "N/A"}</div>
                          </div>
                        </div>

                        <div className="rounded border border-border bg-card p-3">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Timing</span>
                          <div className="mt-1 font-mono text-[11px] space-y-0.5 text-foreground">
                            <div>Started: {rollout ? new Date(rollout.startedAt).toLocaleTimeString() : "—"}</div>
                            <div>Finished: {rollout?.finishedAt ? new Date(rollout.finishedAt).toLocaleTimeString() : "—"}</div>
                            <div>Samples: {rollout?.samples?.length ?? 0} samples</div>
                          </div>
                        </div>

                        <div className="rounded border border-border bg-card p-3 flex flex-col justify-between">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Rollback Controls</span>
                          <div className="mt-2">
                            {rollout?.status === "ROLLED_BACK" ? (
                              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                                <CheckCircle2 className="size-3.5" />
                                Rollback applied
                              </span>
                            ) : rollout ? (
                              <button
                                type="button"
                                onClick={() => setRollbackTarget(rollout)}
                                className="inline-flex items-center gap-1.5 rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                              >
                                <RotateCcw className="size-3" />
                                <span>Trigger Rollback</span>
                              </button>
                            ) : (
                              <span className="text-muted-foreground">No rollout active</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Audit Log Table ── */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="text-sm font-semibold text-foreground">Rollout Audit Trail ({auditLogs.length})</h2>
          <p className="text-[11px] text-muted-foreground">
            Administrative record of rollbacks, pause actions, and target modifications.
          </p>
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No audit log entries recorded for this repository yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{log.action}</span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-mono ${
                        log.result === "success"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {log.result}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Actor: {log.actor} • {new Date(log.ts).toLocaleString()}
                  </div>
                </div>
                {Boolean(log.details) && (
                  <pre className="font-mono text-[10px] text-muted-foreground max-w-xs truncate">
                    {JSON.stringify(log.details)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Manual Rollback Warning Modal ── */}
      {rollbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Confirm Manual Rollback</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  You are about to roll back the active PM2 process to its prior release.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Commit:</span>
                <span className="font-bold text-foreground">{rollbackTarget.commitSha.slice(0, 7)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target PM2 App:</span>
                <span className="font-bold text-foreground">
                  {(connection?.storedConfig as { name?: string } | null | undefined)?.name || "configured target"}
                </span>
              </div>
            </div>

            {/* Critical Warning Alert */}
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Important Operational Notice</span>
              </p>
              <p className="mt-1 text-rose-600 dark:text-rose-300">
                Database schema migrations and data changes are NOT reverted by process rollback. Only application code and process execution symlinks are switched back.
              </p>
            </div>

            {rollbackError && (
              <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                {rollbackError}
              </div>
            )}

            {rollbackSuccess && (
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                {rollbackSuccess}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRollbackTarget(null)}
                disabled={rollingBack}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRollback}
                disabled={rollingBack}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
              >
                {rollingBack ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                <span>{rollingBack ? "Executing Rollback..." : "Confirm Rollback"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
