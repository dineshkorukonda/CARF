"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderGit2,
  Terminal,
  RotateCcw,
  Clock,
  ArrowLeft,
  AlertTriangle,
  Pause,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  RefreshCw,
  Server,
  Copy,
  Check,
  ShieldCheck,
  KeyRound,
  Ban,
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
} from "recharts";
import {
  deriveRepoStatus,
  getStatusBadgeVariant,
  deriveAgentStatus,
  getAgentBadgeVariant,
} from "../../../../lib/repoStatusDerivation";
import { useLiveRolloutPolling } from "../../../../lib/useLiveRolloutPolling";
import { commitPageHref, repoSetupHref } from "../../../../lib/dashboardNav";

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
  code: number;
  config: number;
  dependency: number;
  infrastructure: number;
}

export interface ThresholdItem {
  finalThreshold: number;
  finalWindow: number;
  activeTypes: string[];
}

export interface CommitWithDetails {
  id: string;
  sha: string;
  message: string;
  author: string;
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

export interface RepoConnectionDetails {
  id: string;
  verifiedAt: Date | string | null;
  monitoringPaused: boolean;
  storedConfig?: unknown;
  installTokenPrefix?: string | null;
  agentLastHeartbeat?: Date | string | null;
  agentRevoked?: boolean | null;
  agentVersion?: string | null;
  verificationReport?: unknown;
}

interface RepoDetailViewProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  installationId: string;
  connection?: RepoConnectionDetails | null;
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

  // Agent State
  const [agentRevoked, setAgentRevoked] = useState<boolean>(Boolean(connection?.agentRevoked));
  const [revokingAgent, setRevokingAgent] = useState<boolean>(false);
  const [generatingToken, setGeneratingToken] = useState<boolean>(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedAgentCmd, setCopiedAgentCmd] = useState<boolean>(false);
  const [showAgentSettings, setShowAgentSettings] = useState<boolean>(false);
  const [agentActionMessage, setAgentActionMessage] = useState<string | null>(null);

  const agentStatus = deriveAgentStatus({
    agentLastHeartbeat: connection?.agentLastHeartbeat,
    agentRevoked,
  });
  const agentBadge = getAgentBadgeVariant(agentStatus);

  // Filters
  const [outcomeFilter, setOutcomeFilter] = useState<string>("ALL");
  const [expandedCommitSha, setExpandedCommitSha] = useState<string | null>(null);
  const [refreshingCommits, setRefreshingCommits] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const router = useRouter();

  const refreshCommits = async () => {
    setRefreshingCommits(true);
    setRefreshMessage(null);
    try {
      const res = await fetch("/api/repo/refresh-commits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installationId, owner, repo, branch: defaultBranch }),
      });
      const data = (await res.json()) as {
        error?: string;
        pulled?: Array<{ sha: string }>;
        failed?: Array<{ sha: string }>;
        soakSha?: string | null;
      };
      if (!res.ok) {
        setRefreshMessage(data.error ?? "Refresh failed");
        return;
      }
      const pulled = data.pulled?.length ?? 0;
      const failed = data.failed?.length ?? 0;
      if (data.soakSha) {
        setRefreshMessage(`Live soak started on ${data.soakSha.slice(0, 7)}. Open Pipeline — rollback should decide on that SHA.`);
      } else if (pulled === 0 && failed === 0) {
        setRefreshMessage("No missing commits on this branch.");
      } else if (failed === 0) {
        setRefreshMessage(`Classified ${pulled} commit${pulled === 1 ? "" : "s"} that the push tip had skipped.`);
      } else {
        setRefreshMessage(`Classified ${pulled}, ${failed} failed.`);
      }
      router.refresh();
    } catch {
      setRefreshMessage("Refresh failed");
    } finally {
      setRefreshingCommits(false);
    }
  };

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
    isConfigured: Boolean(connection),
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
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      setMonitoringPaused(nextPaused);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to toggle pause state");
    } finally {
      setTogglingPause(false);
    }
  };

  // Revoke Agent Token
  const handleRevokeAgent = async () => {
    if (
      !confirm(
        `Are you sure you want to revoke the agent for ${owner}/${repo}? The agent on your server will be disconnected and unable to report heartbeats.`
      )
    ) {
      return;
    }

    setRevokingAgent(true);
    setAgentActionMessage(null);
    try {
      const res = await fetch("/api/repo/revoke-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId, owner, repo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setAgentRevoked(true);
      setGeneratedToken(null);
      setAgentActionMessage("Agent token revoked. Agent status flipped to revoked.");
    } catch (err: unknown) {
      setAgentActionMessage(err instanceof Error ? err.message : "Failed to revoke agent");
    } finally {
      setRevokingAgent(false);
    }
  };

  // Generate Fresh Token
  const handleGenerateNewToken = async () => {
    setGeneratingToken(true);
    setAgentActionMessage(null);
    try {
      const res = await fetch("/api/repo/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId, owner, repo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setGeneratedToken(data.token);
      setAgentRevoked(false);
      setAgentActionMessage("New install token generated. Run the updated install command on your host.");
    } catch (err: unknown) {
      setAgentActionMessage(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setGeneratingToken(false);
    }
  };

  const centralOrigin = typeof window !== "undefined" ? window.location.origin : "https://carf.indevs.in";
  const activeToken = generatedToken || (connection?.installTokenPrefix ? `${connection.installTokenPrefix}...` : "<install_token>");
  const agentInstallCmd = `curl -fsSL ${centralOrigin}/install.sh | bash -s -- --token=${activeToken}`;

  const copyAgentCmd = () => {
    navigator.clipboard.writeText(agentInstallCmd);
    setCopiedAgentCmd(true);
    setTimeout(() => setCopiedAgentCmd(false), 2000);
  };

  // Trigger manual rollback
  const handleManualRollback = async () => {
    if (!rollbackTarget) return;
    setRollingBack(true);
    setRollbackError(null);
    setRollbackSuccess(null);

    try {
      const res = await fetch(
        `/api/repo/${encodeURIComponent(owner)}/${encodeURIComponent(
          repo
        )}/rollback/${encodeURIComponent(rollbackTarget.commitSha)}?installationId=${encodeURIComponent(
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
        code: cv ? Number((cv.code * 100).toFixed(0)) : 0,
        config: cv ? Number((cv.config * 100).toFixed(0)) : 0,
        dependency: cv ? Number((cv.dependency * 100).toFixed(0)) : 0,
        infra: cv ? Number((cv.infrastructure * 100).toFixed(0)) : 0,
      };
    }).reverse();
  }, [commits]);

  // --- Graph 4 Data: Outcome Breakdown ---
  const graph4Data = useMemo(() => {
    const counts = { SUCCESS: 0, ROLLED_BACK: 0, FAILED: 0, PENDING: 0 };
    liveRollouts.forEach((r) => {
      if (counts[r.status] !== undefined) {
        counts[r.status]++;
      }
    });
    return [
      { name: "Promoted", count: counts.SUCCESS, fill: "#10b981" },
      { name: "Rolled Back", count: counts.ROLLED_BACK, fill: "#ef4444" },
      { name: "Failed", count: counts.FAILED, fill: "#f59e0b" },
      { name: "Observing", count: counts.PENDING, fill: "#6366f1" },
    ];
  }, [liveRollouts]);

  // Filtered Commits Table
  const filteredCommits = useMemo(() => {
    const list = commits.filter((c) => {
      const matchingRollout = liveRollouts.find((r) => r.commitSha === c.sha);
      if (outcomeFilter === "ALL") return true;
      if (outcomeFilter === "NONE") return !matchingRollout;
      return matchingRollout?.status === outcomeFilter;
    });

    return list.slice().sort((a, b) => {
      const rolloutA = liveRollouts.find((r) => r.commitSha === a.sha);
      const rolloutB = liveRollouts.find((r) => r.commitSha === b.sha);
      const timeA = Math.max(
        rolloutA ? new Date(rolloutA.startedAt).getTime() : 0,
        new Date(a.createdAt).getTime()
      );
      const timeB = Math.max(
        rolloutB ? new Date(rolloutB.startedAt).getTime() : 0,
        new Date(b.createdAt).getTime()
      );
      return timeB - timeA;
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
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${agentBadge.colorClass}`}
              >
                <span className={`size-1.5 rounded-full ${agentBadge.dotClass}`} />
                {agentBadge.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {connection?.verifiedAt
                ? `Connection verified: ${new Date(connection.verifiedAt).toLocaleString()}`
                : "Linked — host verify has not passed yet. Rollouts still run from .carf.yml."}
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

          <button
            type="button"
            onClick={() => setShowAgentSettings(!showAgentSettings)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition-colors"
          >
            <Server className="size-3.5 text-primary" />
            <span>Host Agent</span>
            <ChevronDown className={`size-3 transition-transform ${showAgentSettings ? "rotate-180" : ""}`} />
          </button>

          <Link
            href={repoSetupHref(owner, repo, { edit: true })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
          >
            <Terminal className="size-3.5" />
            <span>Edit connection</span>
          </Link>
        </div>
      </div>

      {/* Expandable Host Agent Card */}
      {showAgentSettings && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Server className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Host PM2 Agent Configuration</h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Colocated agent monitoring PM2 processes and streaming telemetry over HTTPS with zero database credentials.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${agentBadge.colorClass}`}>
                <span className={`size-1.5 rounded-full ${agentBadge.dotClass}`} />
                {agentBadge.label} {connection?.agentVersion ? `(v${connection.agentVersion})` : ""}
              </span>
            </div>
          </div>

          {agentActionMessage && (
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-primary">
              {agentActionMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">Last Heartbeat</div>
              <div className="mt-1 font-semibold text-foreground font-mono">
                {connection?.agentLastHeartbeat ? new Date(connection.agentLastHeartbeat).toLocaleString() : "Never reported"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">Installed Version</div>
              <div className="mt-1 font-semibold text-foreground font-mono">
                {connection?.agentVersion || "N/A"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">Token Prefix</div>
              <div className="mt-1 font-semibold text-foreground font-mono">
                {connection?.installTokenPrefix ? `${connection.installTokenPrefix}...` : "None"}
              </div>
            </div>
          </div>

          {/* Installer Command */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">One-line Host Installer Command:</span>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px]">
                <ShieldCheck className="size-3.5" />
                <span>Zero DB credentials • Scoped token</span>
              </div>
            </div>
            <div className="relative">
              <pre className="rounded-lg border border-border bg-slate-950 p-3 font-mono text-xs text-slate-100 overflow-x-auto select-all">
                {agentInstallCmd}
              </pre>
              <button
                type="button"
                onClick={copyAgentCmd}
                className="absolute top-2 right-2 inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800 transition-colors"
              >
                {copiedAgentCmd ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                <span>{copiedAgentCmd ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Agent Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border">
            <div className="text-[11px] text-muted-foreground">
              To uninstall on host: <code className="font-mono bg-muted/60 px-1 py-0.5 rounded">curl -fsSL {centralOrigin}/install.sh | bash -s -- --uninstall</code>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateNewToken}
                disabled={generatingToken}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted disabled:opacity-50"
              >
                {generatingToken ? <Loader2 className="size-3 animate-spin" /> : <KeyRound className="size-3" />}
                <span>Generate Fresh Token</span>
              </button>

              {!agentRevoked && (
                <button
                  type="button"
                  onClick={handleRevokeAgent}
                  disabled={revokingAgent}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 shadow-xs hover:bg-red-500/20 disabled:opacity-50"
                >
                  {revokingAgent ? <Loader2 className="size-3 animate-spin" /> : <Ban className="size-3" />}
                  <span>Revoke Agent</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
                Live soak observation samples comparing error rate to the dynamic threshold.
              </p>
            </div>
            {liveRollouts.length > 0 && (
              <select
                value={selectedRolloutId}
                onChange={(e) => setSelectedRolloutId(e.target.value)}
                className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {liveRollouts.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.commitSha.slice(0, 7)} ({r.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-4 h-64 w-full">
            {graph1Data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graph1Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      fontSize: 12,
                      borderRadius: 8,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="errorRate"
                    name="Observed Error Rate (%)"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="threshold"
                    name="Threshold (%)"
                    stroke="#6366f1"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No telemetry samples recorded for this rollout yet.
              </div>
            )}
          </div>
        </div>

        {/* Graph 2: Threshold & Window per Commit */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">Dynamic Threshold & Window by Commit</h2>
            <p className="text-[11px] text-muted-foreground">
              Calibrated sensitivity and observation soak windows per commit change type.
            </p>
          </div>

          <div className="mt-4 h-64 w-full">
            {graph2Data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graph2Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="sha" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit="%" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="s" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      fontSize: 12,
                      borderRadius: 8,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="threshold" name="Threshold (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="window" name="Window (s)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No commit classifications recorded.
              </div>
            )}
          </div>
        </div>

        {/* Graph 3: Change Vector Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">Change-Vector Composition (%)</h2>
            <p className="text-[11px] text-muted-foreground">
              Weighted proportion of code, config, dependency, and infrastructure modifications.
            </p>
          </div>

          <div className="mt-4 h-64 w-full">
            {graph3Data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graph3Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="sha" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <YAxis tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      fontSize: 12,
                      borderRadius: 8,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="code" name="Code" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="config" name="Config" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="dependency" name="Dependency" fill="#ec4899" stackId="a" />
                  <Bar dataKey="infra" name="Infra" fill="#10b981" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No vector compositions available.
              </div>
            )}
          </div>
        </div>

        {/* Graph 4: Rollout Outcomes */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">Rollout Outcomes Breakdown</h2>
            <p className="text-[11px] text-muted-foreground">
              Aggregate distribution of successful rollouts, rollbacks, and failures.
            </p>
          </div>

          <div className="mt-4 h-64 w-full">
            {liveRollouts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graph4Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      fontSize: 12,
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="count" name="Rollouts" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No rollouts observed yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Commits & Rollout Lifecycle Table ── */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Commits & Rollout Lifecycle ({filteredCommits.length})
            </h2>
            <p className="text-[11px] text-muted-foreground">
              History of analyzed commits, calibrated thresholds, and active or past rollouts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshCommits}
              disabled={refreshingCommits}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${refreshingCommits ? "animate-spin" : ""}`} />
              <span>{refreshingCommits ? "Pulling & classifying..." : "Refresh commits"}</span>
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
              {["ALL", "PENDING", "SUCCESS", "ROLLED_BACK", "FAILED", "NONE"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOutcomeFilter(f)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    outcomeFilter === f
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "NONE" ? "Unmonitored" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {refreshMessage ? (
          <p className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-foreground" role="status">
            {refreshMessage}
          </p>
        ) : null}

        <div className="mt-4 divide-y divide-border border border-border rounded-lg overflow-hidden">
          {filteredCommits.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No commits match the selected outcome filter.
            </div>
          ) : (
            filteredCommits.map((c) => {
              const rollout = liveRollouts.find((r) => r.commitSha === c.sha);
              const isExpanded = expandedCommitSha === c.sha;

              return (
                <div key={c.sha} className="transition-colors hover:bg-muted/10">
                  <div className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedCommitSha(isExpanded ? null : c.sha)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={commitPageHref(owner, repo, c.sha)}
                            className="font-mono font-semibold text-primary hover:underline"
                          >
                            {c.sha.slice(0, 7)}
                          </Link>
                          <span className="font-medium text-foreground truncate max-w-sm sm:max-w-md">
                            {c.message}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{c.author}</span>
                          <span>•</span>
                          <span>{new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Rollout Status Badge */}
                      {rollout ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              rollout.status === "SUCCESS"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : rollout.status === "ROLLED_BACK"
                                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                : rollout.status === "FAILED"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 animate-pulse"
                            }`}
                          >
                            {rollout.status === "SUCCESS"
                              ? "Promoted"
                              : rollout.status === "ROLLED_BACK"
                              ? "Rolled Back"
                              : rollout.status === "PENDING"
                              ? "Observing"
                              : rollout.status}
                          </span>

                          {rollout.status === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => {
                                setRollbackTarget(rollout);
                                setRollbackError(null);
                                setRollbackSuccess(null);
                              }}
                              className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20"
                            >
                              <RotateCcw className="size-3" />
                              <span>Roll Back</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground font-mono">No rollout</span>
                      )}

                      {/* Threshold info pill */}
                      {c.threshold ? (
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {(c.threshold.finalThreshold * 100).toFixed(1)}% / {c.threshold.finalWindow}s
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="bg-muted/20 p-4 border-t border-border space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">Change Vector</span>
                          <div className="mt-1 font-mono text-[11px] text-foreground">
                            Code: {c.changeVector ? (c.changeVector.code * 100).toFixed(0) : 0}% | Config:{" "}
                            {c.changeVector ? (c.changeVector.config * 100).toFixed(0) : 0}%
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">Dependencies / Infra</span>
                          <div className="mt-1 font-mono text-[11px] text-foreground">
                            Deps: {c.changeVector ? (c.changeVector.dependency * 100).toFixed(0) : 0}% | Infra:{" "}
                            {c.changeVector ? (c.changeVector.infrastructure * 100).toFixed(0) : 0}%
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">Calibrated Soak Window</span>
                          <div className="mt-1 font-mono text-[11px] text-foreground">
                            {c.threshold ? `${c.threshold.finalWindow} seconds` : "Default (300s)"}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">Active Rule Tags</span>
                          <div className="mt-1 font-mono text-[11px] text-foreground">
                            {c.threshold?.activeTypes?.join(", ") || "standard"}
                          </div>
                        </div>
                      </div>

                      {rollout && (
                        <div className="mt-2 rounded border border-border bg-card p-3">
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">Rollout Telemetry Summary</span>
                          <div className="mt-1 flex flex-wrap gap-4 text-[11px] font-mono text-foreground">
                            <span>Started: {new Date(rollout.startedAt).toLocaleTimeString()}</span>
                            <span>
                              Finished: {rollout.finishedAt ? new Date(rollout.finishedAt).toLocaleTimeString() : "In progress"}
                            </span>
                            {rollout.reason && <span>Reason: {rollout.reason}</span>}
                            <span>Samples recorded: {rollout.samples?.length || 0}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Audit Logs Section ── */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="border-b border-border pb-3">
          <h2 className="text-sm font-semibold text-foreground">Automated Action Audit Trail</h2>
          <p className="text-[11px] text-muted-foreground">
            Immutable log of rollbacks triggered by CARF, webhook events, and operator actions.
          </p>
        </div>

        <div className="mt-3 divide-y divide-border border border-border rounded-lg overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No audit records logged yet.
            </div>
          ) : (
            auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{log.action}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {log.actor}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Result: <span className="font-mono text-foreground">{log.result}</span>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(log.ts).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Manual Rollback Modal ── */}
      {rollbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ShieldAlert className="size-5" />
              <h3 className="text-base font-bold text-foreground">Confirm Manual Rollback</h3>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Triggering a manual rollback will instruct the host adapter to reload PM2 to the previous
              active release commit for:
            </p>

            <div className="my-4 rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs">
              <div>Commit: <span className="font-bold text-foreground">{rollbackTarget.commitSha}</span></div>
              <div className="mt-1">Window: {rollbackTarget.window}s</div>
              <div className="mt-1">Threshold: {(rollbackTarget.threshold * 100).toFixed(1)}%</div>
            </div>

            {rollbackError && (
              <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
                {rollbackError}
              </div>
            )}

            {rollbackSuccess && (
              <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                {rollbackSuccess}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRollbackTarget(null)}
                disabled={rollingBack}
                className="rounded-lg border border-border px-3.5 py-2 text-xs text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleManualRollback}
                disabled={rollingBack}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rollingBack ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                <span>{rollingBack ? "Executing Rollback..." : "Rollback Process"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
