"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  Zap,
  CheckCircle2,
  Activity,
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
import { resolveRepoMode, resolveAugmentIntegration, type AugmentIntegration } from "../../../../lib/deploymentMode";
import { resolveFromLegacy } from "../../../../lib/capabilities";
import { GitHubActionsIntegrationPanel } from "./GitHubActionsIntegrationPanel";
import { useLiveRolloutPolling } from "../../../../lib/useLiveRolloutPolling";
import { commitPageHref, projectSectionHref, repoSetupHref, type ProjectSection } from "../../../../lib/dashboardNav";

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
  message?: string;
  author?: string;
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
  mode?: string | null;
  deploymentIntegration?: string | null;
  runtimeAdapter?: string | null;
  pm2Process?: string | null;
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
  view: ProjectSection;
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
  view,
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
  const resolved = resolveFromLegacy({
    mode: connection?.mode,
    deploymentIntegration: connection?.deploymentIntegration,
    runtimeAdapter: connection?.runtimeAdapter,
    storedConfig: connection?.storedConfig,
    repo,
  });
  const mode = resolveRepoMode(connection);
  const isPm2 = resolved.runtimeAdapter === "pm2";
  const isStandalone = resolved.capabilities.rollback || mode === "standalone";
  const isAugment = !resolved.capabilities.rollback && mode === "augment";
  const augmentIntegration = resolveAugmentIntegration(connection);

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

  // Agent State (Standalone)
  const [agentRevoked, setAgentRevoked] = useState<boolean>(Boolean(connection?.agentRevoked));
  const [revokingAgent, setRevokingAgent] = useState<boolean>(false);
  const [generatingToken, setGeneratingToken] = useState<boolean>(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedAgentCmd, setCopiedAgentCmd] = useState<boolean>(false);
  const [showAgentSettings, setShowAgentSettings] = useState<boolean>(false);
  const [agentActionMessage, setAgentActionMessage] = useState<string | null>(null);

  const isHostColocated = !connection?.agentLastHeartbeat && Boolean(connection?.verifiedAt);
  // PM2 Local Runtime State
  const [pm2Status, setPm2Status] = useState<{
    runtime: string;
    connected: boolean;
    processName: string | null;
    processFound: boolean;
    process: {
      name: string;
      status: string;
      pid?: number;
      uptime?: number;
      cpu?: number;
      memory?: number;
      restarts?: number;
      cwd?: string;
    } | null;
    processes: Array<{
      name: string;
      status: string;
      pid?: number;
      uptime?: number;
      cpu?: number;
      memory?: number;
      restarts?: number;
      cwd?: string;
    }>;
    error?: string;
  } | null>(null);
  const [loadingPm2, setLoadingPm2] = useState<boolean>(false);
  const [showProcessPicker, setShowProcessPicker] = useState<boolean>(false);
  const [savingProcess, setSavingProcess] = useState<boolean>(false);

  const fetchPm2Status = useCallback(async () => {
    setLoadingPm2(true);
    try {
      const res = await fetch(
        `/api/pm2/status?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
          repo
        )}&installationId=${encodeURIComponent(installationId)}`
      );
      if (res.ok) {
        const data = await res.json();
        setPm2Status(data);
      }
    } catch (e) {
      console.error("Failed to load PM2 status", e);
    } finally {
      setLoadingPm2(false);
    }
  }, [owner, repo, installationId]);

  useEffect(() => {
    let cancelled = false;
    if (isPm2) {
      const id = window.setTimeout(() => {
        if (!cancelled) {
          void fetchPm2Status();
        }
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(id);
      };
    }
  }, [isPm2, fetchPm2Status]);

  const handleSaveProcess = async (procName: string) => {
    if (!procName) return;
    setSavingProcess(true);
    try {
      const res = await fetch("/api/repo/set-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, processName: procName, installationId }),
      });
      if (res.ok) {
        setShowProcessPicker(false);
        await fetchPm2Status();
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to set process:", err);
    } finally {
      setSavingProcess(false);
    }
  };


  const agentStatus = deriveAgentStatus({
    agentLastHeartbeat: connection?.agentLastHeartbeat,
    agentRevoked,
    isVerified: Boolean(connection?.verifiedAt),
  });
  const agentBadge = getAgentBadgeVariant(agentStatus);

  // Augment Verification & Snippet State
  const [activeSnippetTab, setActiveSnippetTab] = useState<AugmentIntegration>(augmentIntegration);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [copiedApiKey, setCopiedApiKey] = useState<boolean>(false);
  const [verifyingPolicy, setVerifyingPolicy] = useState<boolean>(false);
  const [policyVerifyResult, setPolicyVerifyResult] = useState<{
    success: boolean;
    policyReady: boolean;
    threshold?: number;
    window?: number;
    message?: string;
  } | null>(null);

  // Filters
  const [outcomeFilter, setOutcomeFilter] = useState<string>("ALL");
  const [commitSearch, setCommitSearch] = useState("");
  const [changeTypeFilter, setChangeTypeFilter] = useState("ALL");
  const [expandedCommitSha, setExpandedCommitSha] = useState<string | null>(null);
  const [refreshingCommits, setRefreshingCommits] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [refreshFailures, setRefreshFailures] = useState<Array<{ sha: string; error: string }>>([]);
  const router = useRouter();

  const refreshCommits = async () => {
    setRefreshingCommits(true);
    setRefreshMessage(null);
    setRefreshFailures([]);
    try {
      const res = await fetch("/api/repo/refresh-commits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installationId, owner, repo, branch: defaultBranch }),
      });
      const data = (await res.json()) as {
        error?: string;
        pulled?: Array<{ sha: string }>;
        failed?: Array<{ sha: string; error: string }>;
        soakSha?: string | null;
        skipped?: Array<{ sha: string; reason: string }>;
      };
      if (!res.ok) {
        setRefreshMessage(data.error ?? "Refresh failed");
        return;
      }
      const pulled = data.pulled?.length ?? 0;
      const failed = data.failed?.length ?? 0;
      setRefreshFailures(data.failed ?? []);
      if (data.skipped?.length && failed === 0) {
        setRefreshMessage(`Analyzed ${pulled} commits; skipped ${data.skipped.length} empty diffs. Refresh does not deploy or start monitoring.`);
      } else if (data.soakSha) {
        setRefreshMessage(`Live soak started on ${data.soakSha.slice(0, 7)}. Open Pipeline — rollback should decide on that SHA.`);
      } else if (pulled === 0 && failed === 0) {
        setRefreshMessage("No missing commits on this branch.");
      } else if (failed === 0) {
        setRefreshMessage(`Classified ${pulled} historical commit${pulled === 1 ? "" : "s"}. Refresh does not deploy or start monitoring.`);
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
    mode,
  });

  const badge = getStatusBadgeVariant(derivedStatus);

  // Toggle monitoring pause (Standalone only)
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
      if (res.ok) {
        setMonitoringPaused(nextPaused);
      }
    } catch (err) {
      console.error("Failed to toggle monitoring pause:", err);
    } finally {
      setTogglingPause(false);
    }
  };

  // Generate new token (Standalone only)
  const generateNewToken = async () => {
    setGeneratingToken(true);
    setAgentActionMessage(null);
    try {
      const res = await fetch("/api/repo/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId, owner, repo }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setGeneratedToken(data.token);
        setAgentRevoked(false);
        setAgentActionMessage("New agent token minted. Run the installer command on your host.");
      } else {
        setAgentActionMessage(data.error || "Failed to generate token.");
      }
    } catch {
      setAgentActionMessage("Network error while generating token.");
    } finally {
      setGeneratingToken(false);
    }
  };

  // Revoke agent (Standalone only)
  const revokeAgent = async () => {
    if (!confirm("Are you sure you want to revoke this agent? It will immediately stop receiving telemetry.")) {
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
      if (res.ok) {
        setAgentRevoked(true);
        setGeneratedToken(null);
        setAgentActionMessage("Agent revoked. Any running host agent with the previous token is now rejected.");
      } else {
        setAgentActionMessage(data.error || "Failed to revoke agent.");
      }
    } catch {
      setAgentActionMessage("Network error while revoking agent.");
    } finally {
      setRevokingAgent(false);
    }
  };

  // Run Augment Policy Verification
  const runPolicyVerification = async () => {
    setVerifyingPolicy(true);
    setPolicyVerifyResult(null);
    try {
      const res = await fetch("/api/repo/augment-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          owner,
          repo,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPolicyVerifyResult(data);
      } else {
        setPolicyVerifyResult({
          success: false,
          policyReady: false,
          message: data.error || "Verification failed",
        });
      }
    } catch (err: unknown) {
      setPolicyVerifyResult({
        success: false,
        policyReady: false,
        message: err instanceof Error ? err.message : "Verification request failed",
      });
    } finally {
      setVerifyingPolicy(false);
    }
  };

  // Origins
  const centralOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://carf.indevs.in";
  const coreApiOrigin = centralOrigin;

  const effectiveToken = generatedToken || "";
  const agentInstallCmd = effectiveToken
    ? `curl -fsSL ${centralOrigin}/install.sh | bash -s -- --token=${effectiveToken}`
    : `curl -fsSL ${centralOrigin}/install.sh | bash -s -- --token=<CLICK_GENERATE_BELOW>`;

  const copyAgentCmd = () => {
    navigator.clipboard.writeText(agentInstallCmd);
    setCopiedAgentCmd(true);
    setTimeout(() => setCopiedAgentCmd(false), 2000);
  };

  // Manual Rollback Execution
  const executeManualRollback = async () => {
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

  // --- Graph 1 Data: Error Rate vs Threshold Over Time (Standalone) ---
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

  // --- Graph 2 Data: Threshold & Window per Commit (Standalone & Augment) ---
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

  // --- Graph 3 Data: Change Vector Breakdown per Commit ---
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
      if (commitSearch && !`${c.sha} ${c.message ?? ""}`.toLowerCase().includes(commitSearch.toLowerCase())) return false;
      if (changeTypeFilter !== "ALL" && !c.threshold?.activeTypes.includes(changeTypeFilter)) return false;
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
  }, [commits, liveRollouts, outcomeFilter, commitSearch, changeTypeFilter]);

  // Snippets for Augment view
  const argoRolloutsSnippet = `apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: carf-canary-gate
spec:
  metrics:
  - name: carf-change-aware-threshold
    interval: 30s
    successCondition: result <= 0.05
    provider:
      web:
        url: "${coreApiOrigin}/v1/threshold?owner=${owner}&repo=${repo}&commit={{args.commit-sha}}"
        headers:
          - key: Authorization
            value: "Bearer {{args.carf-api-key}}"
        jsonPath: "{$.threshold}"`;

  const flaggerSnippet = `apiVersion: flagger.app/v1beta1
kind: MetricTemplate
metadata:
  name: carf-policy-gate
  namespace: test
spec:
  provider:
    type: webhook
    address: "${coreApiOrigin}/v1/threshold?owner=${owner}&repo=${repo}"
    secretRef:
      name: carf-api-secret`;

  const genericHttpSnippet = `# Query change-aware threshold from your deployment pipeline:
curl -fsSL "${coreApiOrigin}/v1/threshold?owner=${owner}&repo=${repo}&commit=\${COMMIT_SHA}" \\
  -H "Authorization: Bearer \${CARF_API_KEY}"`;

  const currentSnippet =
    activeSnippetTab === "argo-rollouts"
      ? argoRolloutsSnippet
      : activeSnippetTab === "flagger"
      ? flaggerSnippet
      : genericHttpSnippet;

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
            {isStandalone ? (
              <FolderGit2 className="size-5 text-primary" />
            ) : (
              <Zap className="size-5 text-blue-500" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {owner}/{repo}
              </h1>
              <span className="rounded border border-border bg-muted/40 px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                {defaultBranch}
              </span>

              {/* 3-LAYER ARCHITECTURE BADGES */}
              <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
                {resolved.integrationLabel}
              </span>
              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                  resolved.runtimeStatus === "active"
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                    : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                }`}
              >
                {resolved.runtimeLabel}
              </span>

              {/* STATUS BADGE */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.colorClass}`}
              >
                <span className={`size-1.5 rounded-full ${badge.dotClass}`} />
                {derivedStatus}
              </span>

              {/* AGENT BADGE (When Agent Required) */}
              {resolved.requiresAgent && !isPm2 && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${agentBadge.colorClass}`}
                >
                  <span className={`size-1.5 rounded-full ${agentBadge.dotClass}`} />
                  {agentBadge.label}
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>
              {isStandalone ? (
                derivedStatus === "Adapter error" && liveRollouts[0]?.reason ? (
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    Adapter error on {liveRollouts[0].commitSha ? liveRollouts[0].commitSha.slice(0, 7) : "latest"}: {liveRollouts[0].reason}
                  </span>
                ) : connection?.verifiedAt ? (
                  `Connection verified: ${new Date(connection.verifiedAt).toLocaleString()}`
                ) : (
                  "Linked — host verify has not passed yet. Rollouts still run from .carf.yml."
                )
              ) : (
                "Augment Mode — CARF provides change-aware threshold & window policy to your external deployment orchestrator."
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {view === "overview" && isStandalone ? (
            <>
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

              {!isPm2 && (
                <button
                  type="button"
                  onClick={() => setShowAgentSettings(!showAgentSettings)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition-colors"
                >
                  <Server className="size-3.5 text-primary" />
                  <span>Host Agent</span>
                  <ChevronDown className={`size-3 transition-transform ${showAgentSettings ? "rotate-180" : ""}`} />
                </button>
              )}

              <Link href={projectSectionHref(owner, repo, "settings")} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted">
                <Terminal className="size-3.5" /><span>Project settings</span>
              </Link>
            </>
          ) : view === "overview" ? (
            <>
              <button
                type="button"
                onClick={runPolicyVerification}
                disabled={verifyingPolicy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition-colors"
              >
                <RefreshCw className={`size-3.5 ${verifyingPolicy ? "animate-spin" : ""}`} />
                <span>{verifyingPolicy ? "Testing..." : "Test Policy Engine"}</span>
              </button>

              <Link href={projectSectionHref(owner, repo, "settings")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90">
                <Zap className="size-3.5" /><span>Project settings</span>
              </Link>
            </>
          ) : (
            <Link href={repoSetupHref(owner, repo, { edit: true })} className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted">Edit connection</Link>
          )}
        </div>
      </div>

      {view === "overview" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Latest rollout</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{liveRollouts[0]?.status === "PENDING" ? "Observing" : liveRollouts[0]?.status?.replaceAll("_", " ") ?? "No rollout"}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{liveRollouts[0]?.commitSha.slice(0, 7) ?? "Awaiting deployment"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Latest analyzed commit</p>
              {commits[0] ? <Link href={commitPageHref(owner, repo, commits[0].sha)} className="mt-2 block font-mono text-lg font-semibold text-primary hover:underline">{commits[0].sha.slice(0, 7)}</Link> : <p className="mt-2 text-lg font-semibold text-foreground">None yet</p>}
              <p className="mt-1 text-xs text-muted-foreground">{commits[0]?.threshold ? `${(commits[0].threshold.finalThreshold * 100).toFixed(2)}% ceiling · ${commits[0].threshold.finalWindow}s window` : "Policy pending"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Runtime</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{isPm2 ? pm2Status?.process?.status ?? "Unknown" : resolved.runtimeLabel}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{isPm2 ? pm2Status?.processName ?? connection?.pm2Process ?? "Process unselected" : resolved.integrationLabel}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Monitoring</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{monitoringPaused ? "Paused" : "Active"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{connection?.verifiedAt ? `Verified ${new Date(connection.verifiedAt).toLocaleDateString()}` : "Connection needs verification"}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
              <Link href={projectSectionHref(owner, repo, "commits")} className="text-xs font-semibold text-primary hover:underline">All commits</Link>
            </div>
            {commits.length === 0 ? <p className="py-5 text-xs text-muted-foreground">No analyzed commits yet.</p> : (
              <div className="divide-y divide-border">
                {commits.slice(0, 5).map((commit) => {
                  const outcome = liveRollouts.find((item) => item.commitSha === commit.sha);
                  return <Link key={commit.sha} href={commitPageHref(owner, repo, commit.sha)} className="flex items-center justify-between gap-3 py-3 text-xs hover:text-primary">
                    <span className="font-mono font-semibold">{commit.sha.slice(0, 7)}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{commit.threshold?.activeTypes.join(", ") || "Awaiting classification"}</span>
                    <span className="font-medium">{outcome?.status === "PENDING" ? "Observing" : outcome?.status?.replaceAll("_", " ") ?? "No rollout"}</span>
                  </Link>;
                })}
              </div>
            )}
          </div>
          <Link href={projectSectionHref(owner, repo, "settings")} className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3 text-xs text-muted-foreground shadow-xs hover:bg-muted/40">
            <span>GitHub Actions {resolved.deploymentIntegration === "github_actions" ? "connected" : "not configured"} · {isPm2 ? `PM2 ${pm2Status?.processName ?? connection?.pm2Process ?? "unconfigured"}` : resolved.runtimeLabel}</span>
            <span className="font-semibold text-primary">Manage integration</span>
          </Link>
        </>
      )}

      {view === "rollouts" && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="border-b border-border pb-3"><h2 className="text-sm font-semibold text-foreground">Rollout history</h2><p className="mt-1 text-xs text-muted-foreground">Observation outcomes and rollback decisions for this project.</p></div>
          {liveRollouts.length === 0 ? <p className="py-6 text-xs text-muted-foreground">No rollouts recorded yet.</p> : <div className="divide-y divide-border">
            {liveRollouts.map((rollout) => <div key={rollout.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-xs">
              <div><Link href={commitPageHref(owner, repo, rollout.commitSha)} className="font-mono font-semibold text-primary hover:underline">{rollout.commitSha.slice(0, 7)}</Link><p className="mt-1 text-muted-foreground" suppressHydrationWarning>{new Date(rollout.startedAt).toLocaleString()} · {(rollout.threshold * 100).toFixed(2)}% / {rollout.window}s</p></div>
              <div className="text-right"><p className="font-semibold text-foreground">{rollout.status.replaceAll("_", " ")}</p><p className="mt-1 text-muted-foreground">{rollout.status === "ROLLED_BACK" ? `Rollback ${rollout.rollbackVerified ? "verified" : "not verified"}` : rollout.reason ?? ""}</p></div>
              {isStandalone && rollout.status === "PENDING" && <button type="button" onClick={() => setRollbackTarget(rollout)} className="rounded-md border border-rose-500/30 px-2.5 py-1.5 font-semibold text-rose-600 hover:bg-rose-500/10">Roll back</button>}
            </div>)}
          </div>}
        </div>
      )}

      {/* ─── PM2 RUNTIME ADAPTER CARD ─── */}
      {view === "settings" && isPm2 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Server className="size-4 text-sky-500" />
                <h3 className="text-sm font-semibold text-foreground">
                  PM2 Runtime Adapter
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Direct local PM2 process runtime control on co-located server. Zero host agent required.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  pm2Status?.connected && pm2Status?.processFound
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : pm2Status?.connected
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    pm2Status?.connected && pm2Status?.processFound
                      ? "bg-emerald-500"
                      : pm2Status?.connected
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                />
                {pm2Status?.connected && pm2Status?.processFound
                  ? "Runtime Connected"
                  : pm2Status?.connected
                  ? "Process Not Found"
                  : "PM2 Not Detected"}
              </span>

              <button
                type="button"
                onClick={fetchPm2Status}
                disabled={loadingPm2}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`size-3 ${loadingPm2 ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">
                Target Process
              </div>
              <div className="mt-1 font-bold text-foreground font-mono truncate">
                {pm2Status?.processName || connection?.pm2Process || "Unconfigured"}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">
                Status
              </div>
              <div className="mt-1 font-semibold text-foreground font-mono flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${
                    pm2Status?.process?.status === "online" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                <span className="capitalize">{pm2Status?.process?.status ?? "unknown"}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">
                PID
              </div>
              <div className="mt-1 font-semibold text-foreground font-mono">
                {pm2Status?.process?.pid ? `#${pm2Status.process.pid}` : "—"}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">
                Uptime / Restarts
              </div>
              <div className="mt-1 font-semibold text-foreground font-mono">
                {pm2Status?.process?.uptime
                  ? `${Math.floor(pm2Status.process.uptime / 3600)}h ${Math.floor((pm2Status.process.uptime % 3600) / 60)}m`
                  : "Active"}{" "}
                <span className="text-muted-foreground font-normal text-[11px]">
                  ({pm2Status?.process?.restarts ?? 0} restarts)
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Associated PM2 Process: <strong className="font-mono text-primary">{pm2Status?.processName || connection?.pm2Process || "Unconfigured"}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowProcessPicker(!showProcessPicker)}
                className="text-xs text-primary hover:underline font-medium"
              >
                {showProcessPicker ? "Cancel" : "Select Different Process"}
              </button>
            </div>

            {showProcessPicker && (
              <div className="pt-2 border-t border-border space-y-2">
                <div className="text-[11px] text-muted-foreground">
                  Detected PM2 processes on local host. Choose which process represents this repository:
                </div>
                <div className="flex flex-wrap gap-2">
                  {(pm2Status?.processes && pm2Status.processes.length > 0
                    ? pm2Status.processes
                    : []
                  ).map((proc) => (
                    <button
                      key={proc.name}
                      type="button"
                      disabled={savingProcess}
                      onClick={() => handleSaveProcess(proc.name)}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono transition-colors ${
                        (pm2Status?.processName || connection?.pm2Process || "Unconfigured") === proc.name
                          ? "border border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold"
                          : "border border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      <Activity className={`size-3 ${proc.status === "online" ? "text-emerald-500" : "text-amber-500"}`} />
                      <span>{proc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
            <div className="flex items-center gap-4">
              <span className="font-medium text-foreground">Capabilities:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Change-aware Policy</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Monitoring</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Rollback Control</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Adapter: <span className="font-mono text-foreground font-semibold">Local PM2 (Direct)</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── STANDALONE: HOST AGENT DRAWER (NON-PM2 ONLY) ─── */}
      {view === "settings" && !isPm2 && isStandalone && showAgentSettings && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Server className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  {isHostColocated ? "Host PM2 Environment (Colocated)" : "Host PM2 Agent Configuration"}
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isHostColocated
                  ? "CARF Core API is running directly on this server alongside PM2 with local process control."
                  : "Colocated agent monitoring PM2 processes and streaming telemetry over HTTPS with zero database credentials."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${agentBadge.colorClass}`}>
                <span className={`size-1.5 rounded-full ${agentBadge.dotClass}`} />
                {agentBadge.label} {connection?.agentVersion ? `(v${connection.agentVersion})` : isHostColocated ? "(Colocated)" : ""}
              </span>
            </div>
          </div>

          {isHostColocated && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
              <Check className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <span className="font-semibold">Native Server Host:</span> CARF Core API and your PM2 app are colocated on this server. Rollout health checks and automatic rollbacks execute natively. A separate background agent daemon is not required.
              </div>
            </div>
          )}

          {agentActionMessage && (
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-primary">
              {agentActionMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">
                {isHostColocated ? "Host Status" : "Last Heartbeat"}
              </div>
              <div className="mt-1 font-semibold text-foreground font-mono" suppressHydrationWarning>
                {connection?.agentLastHeartbeat
                  ? new Date(connection.agentLastHeartbeat).toLocaleString()
                  : connection?.verifiedAt
                    ? `Verified (${new Date(connection.verifiedAt).toLocaleDateString()})`
                    : "Never reported"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">Execution Mode</div>
              <div className="mt-1 font-semibold text-foreground font-mono">
                {connection?.agentVersion ? `Agent v${connection.agentVersion}` : isHostColocated ? "Direct PM2 (Server Host)" : "N/A"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">Token Prefix</div>
              <div className="mt-1 font-semibold text-foreground font-mono">
                {connection?.installTokenPrefix
                  ? `${connection.installTokenPrefix}...`
                  : isHostColocated
                    ? "Local Server (Direct)"
                    : "None"}
              </div>
            </div>
          </div>

          {/* Installer Command */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                {isHostColocated ? "Optional Remote Agent Daemon Installer:" : "One-line Host Installer Command:"}
              </span>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px]">
                <ShieldCheck className="size-3.5" />
                <span>Zero DB credentials • Scoped token</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute top-2.5 left-2.5 z-10">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                  Available
                </span>
              </div>
              <pre className="rounded-lg border border-border bg-slate-950 p-3 pt-8 font-mono text-xs text-slate-100 overflow-x-auto select-all opacity-80">
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={generateNewToken}
                disabled={generatingToken}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition-colors disabled:opacity-50"
              >
                {generatingToken ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                <span>Generate New Token</span>
              </button>

              <button
                type="button"
                onClick={revokeAgent}
                disabled={revokingAgent || agentRevoked}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 shadow-xs hover:bg-rose-500/20 transition-colors disabled:opacity-50"
              >
                {revokingAgent ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
                <span>{agentRevoked ? "Agent Revoked" : "Revoke Token"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── AUGMENT: POLICY & INTEGRATION CARD ─── */}
      {view === "settings" && resolved.deploymentIntegration === "github_actions" && connection?.id && (
        <GitHubActionsIntegrationPanel repositoryId={connection.id} defaultBranch={defaultBranch} />
      )}

      {view === "settings" && resolved.deploymentIntegration !== "github_actions" && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-foreground">
                  Augment Deployment Policy & CD Integration
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                CARF serves risk-calibrated thresholds to your deployment pipeline. Rollout and rollback are executed directly by your CD system.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Policy: Ready
              </span>
            </div>
          </div>

          {/* Endpoint and auth grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">
                CARF Threshold Endpoint
              </div>
              <div className="font-mono text-foreground text-[11px] truncate">
                GET {coreApiOrigin}/v1/threshold?commit=$COMMIT_SHA
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">
                Augment Threshold Endpoint
              </div>
              <div className="font-mono text-foreground text-[11px] truncate">
                GET {coreApiOrigin}/v1/augment/threshold?owner={owner}&repo={repo}&sha=$COMMIT_SHA
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground uppercase">
                <span>Installation API Key</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/repo/api-key", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ installationId }),
                      });
                      const data = (await res.json()) as { apiKey?: string };
                      if (res.ok && data.apiKey) {
                        await navigator.clipboard.writeText(data.apiKey);
                        setCopiedApiKey(true);
                        setTimeout(() => setCopiedApiKey(false), 2000);
                      }
                    } catch {
                      // copy is best-effort
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  {copiedApiKey ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                  <span>{copiedApiKey ? "Copied" : "Copy Key"}</span>
                </button>
              </div>
              <div className="font-mono text-foreground text-[11px]">••••••••••••••••</div>
            </div>
          </div>

          {/* Snippet Viewer */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 border-b border-border">
                {[
                  { id: "argo-rollouts" as AugmentIntegration, label: "Argo Rollouts" },
                  { id: "flagger" as AugmentIntegration, label: "Flagger" },
                  { id: "generic-http" as AugmentIntegration, label: "Generic HTTP" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSnippetTab(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors border-b-2 ${
                      activeSnippetTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentSnippet);
                  setCopiedSnippet(true);
                  setTimeout(() => setCopiedSnippet(false), 2000);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                {copiedSnippet ? <Check className="size-3" /> : <Copy className="size-3" />}
                <span>{copiedSnippet ? "Copied" : "Copy Configuration"}</span>
              </button>
            </div>

            <pre className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto select-all">
              {currentSnippet}
            </pre>
          </div>

          {/* Policy verification response */}
          {policyVerifyResult && (
            <div
              className={`rounded-lg border p-3 text-xs ${
                policyVerifyResult.success
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-rose-500/20 bg-rose-500/10 text-rose-600"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {policyVerifyResult.success ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                <span>{policyVerifyResult.message}</span>
              </div>
              {policyVerifyResult.threshold && (
                <div className="mt-1 text-[11px] font-mono">
                  Calibrated base threshold: {policyVerifyResult.threshold} | Observation window:{" "}
                  {policyVerifyResult.window}s
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── STANDALONE: LIVE POLLING BANNER ─── */}
      {view === "overview" && isStandalone && isPolling && pendingRollout && (
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

      {/* ─── ANALYTICS GRAPHS ─── */}
      {view === "metrics" && <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* STANDALONE: Graph 1 Error Rate vs Threshold Over Time */}
        {isStandalone && (
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
        )}

        {/* STANDALONE & AUGMENT: Graph 2: Threshold & Window per Commit */}
        <div
          className={`rounded-xl border border-border bg-card p-5 shadow-xs ${
            isAugment ? "lg:col-span-2" : ""
          }`}
        >
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">Dynamic Threshold & Window by Commit</h2>
            <p className="text-[11px] text-muted-foreground">
              Calibrated sensitivity and observation soak windows calculated by CARF change-aware policy.
            </p>
          </div>

          <div className="mt-4 h-64 w-full">
            {graph2Data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graph2Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="sha" tick={{ fontSize: 10 }} />
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
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="threshold"
                    name="Threshold (%)"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="right"
                    type="stepAfter"
                    dataKey="window"
                    name="Observation Window (s)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No commit classifications available yet.
              </div>
            )}
          </div>
        </div>

        {/* STANDALONE ONLY: Graph 3 Change Vector Breakdown & Graph 4 Outcome Breakdown */}
        {isStandalone && (
          <>
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="border-b border-border pb-3">
                <h2 className="text-sm font-semibold text-foreground">Change Vector Breakdown by Commit</h2>
                <p className="text-[11px] text-muted-foreground">
                  Proportion of modifications detected across infrastructure, dependencies, config, and code.
                </p>
              </div>

              <div className="mt-4 h-64 w-full">
                {graph3Data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graph3Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="sha" tick={{ fontSize: 10 }} />
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
                      <Bar dataKey="code" name="Code" fill="#3b82f6" stackId="a" />
                      <Bar dataKey="config" name="Config" fill="#10b981" stackId="a" />
                      <Bar dataKey="dependency" name="Dependencies" fill="#f59e0b" stackId="a" />
                      <Bar dataKey="infra" name="Infrastructure" fill="#ef4444" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No change vectors analyzed yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="border-b border-border pb-3">
                <h2 className="text-sm font-semibold text-foreground">Rollout Outcomes Breakdown</h2>
                <p className="text-[11px] text-muted-foreground">
                  Summary of historical verdicts across all recorded rollouts for this repository.
                </p>
              </div>

              <div className="mt-4 h-64 w-full">
                {liveRollouts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graph4Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          fontSize: 12,
                          borderRadius: 8,
                        }}
                      />
                      <Bar dataKey="count" name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No rollouts recorded yet.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>}

      {/* ─── COMMITS & CHANGE CLASSIFICATION TABLE (Standalone & Augment) ─── */}
      {view === "commits" && <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {isStandalone ? "Commits & Rollout Lifecycle" : "Commits & Change-Aware Risk Classification"} ({filteredCommits.length})
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isStandalone
                ? "History of analyzed commits, calibrated thresholds, and active or past rollouts."
                : "History of classified commits with multi-vector change scores and calibrated threshold policies."}
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
            {isStandalone && (
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
            )}
          </div>
        </div>

        {refreshMessage ? (
          <p className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-foreground" role="status">
            {refreshMessage}
          </p>
        ) : null}
        {refreshFailures.length > 0 && (
          <details className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium">View classification failures ({refreshFailures.length})</summary>
            <ul className="mt-2 space-y-2">
              {refreshFailures.map((failure) => <li key={failure.sha}><code>{failure.sha.slice(0, 7)}</code>: {failure.error}</li>)}
            </ul>
          </details>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <input type="search" value={commitSearch} onChange={(event) => setCommitSearch(event.target.value)} placeholder="Search SHA or message" aria-label="Search commits" className="min-w-48 flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground" />
          <select value={changeTypeFilter} onChange={(event) => setChangeTypeFilter(event.target.value)} aria-label="Filter by change type" className="rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground">
            <option value="ALL">All change types</option>
            {["code", "config", "dependency", "infra", "data"].map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        <div className="mt-4 divide-y divide-border border border-border rounded-lg overflow-hidden">
          {filteredCommits.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No commits recorded yet. Push changes to this repository or click &quot;Refresh commits&quot;.
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
                          <span className="font-medium text-foreground truncate max-w-sm sm:max-w-md">{c.message ?? c.threshold?.activeTypes.join(", ") ?? "Classification pending"}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          {c.author && <><span>{c.author}</span><span>•</span></>}
                          <span suppressHydrationWarning>{new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Standalone: Rollout Status Badge */}
                      {isStandalone && (
                        <>
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
                            <span title="Classified policy only; this commit has no deployment or runtime observation record." className="text-[11px] text-muted-foreground font-mono">No rollout</span>
                          )}
                        </>
                      )}

                      {/* Threshold info pill */}
                      {c.threshold ? (
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          Policy: {(c.threshold.finalThreshold * 100).toFixed(1)}% / {c.threshold.finalWindow}s
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="bg-muted/20 p-4 border-t border-border space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase">
                            Calibrated Threshold
                          </span>
                          <p className="font-mono text-foreground font-semibold">
                            {c.threshold ? `${(c.threshold.finalThreshold * 100).toFixed(2)}%` : "N/A"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase">
                            Observation Window
                          </span>
                          <p className="font-mono text-foreground font-semibold">
                            {c.threshold ? `${c.threshold.finalWindow} seconds` : "N/A"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase">
                            Risk Factors
                          </span>
                          <p className="text-foreground">
                            {c.threshold?.activeTypes?.length ? c.threshold.activeTypes.join(", ") : "Standard code change"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-muted-foreground uppercase">
                            Classification
                          </span>
                          <p className="font-mono text-foreground text-[11px]">
                            {c.changeVector
                              ? `code:${(c.changeVector.code * 100).toFixed(0)}% cfg:${(c.changeVector.config * 100).toFixed(0)}% dep:${(c.changeVector.dependency * 100).toFixed(0)}% inf:${(c.changeVector.infrastructure * 100).toFixed(0)}%`
                              : "Standard"}
                          </p>
                        </div>
                      </div>

                      {rollout?.reason && (
                        <div className="mt-3 rounded border border-red-500/20 bg-red-500/5 p-3 text-red-700 dark:text-red-300">
                          <span className="font-semibold uppercase tracking-wider text-[10px] block mb-1">
                            {rollout.status === "FAILED" ? "Rollout / Adapter Failure Reason" : "Rollout Detail"}
                          </span>
                          <p className="font-mono text-xs break-all">{rollout.reason}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>}

      {/* ─── AUDIT LOGS SECTION ─── */}
      {view === "activity" && <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
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
                <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                  {new Date(log.ts).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>}

      {/* ─── MANUAL ROLLBACK MODAL (Standalone Only) ─── */}
      {isStandalone && rollbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-500 font-bold">
              <ShieldAlert className="size-5" />
              <span>Confirm Manual Rollback</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to trigger a manual rollback for commit{" "}
              <strong className="font-mono text-foreground">{rollbackTarget.commitSha.slice(0, 7)}</strong>?
              This instructs the host agent to immediately revert the PM2 deployment.
            </p>

            {rollbackError && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600">
                {rollbackError}
              </div>
            )}
            {rollbackSuccess && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600">
                {rollbackSuccess}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setRollbackTarget(null)}
                className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeManualRollback}
                disabled={rollingBack}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
              >
                {rollingBack && <Loader2 className="size-3.5 animate-spin" />}
                <span>Execute Rollback</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
