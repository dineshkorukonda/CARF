"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderGit2,
  ExternalLink,
  ShieldCheck,
  Zap,
  Search,
  CheckCircle2,
  Sliders,
  Activity,
  Terminal,
  Container,
  Server,
  GitBranch,
  ArrowUpRight,
  AlertTriangle,
  Radio,
  Lock,
  Plus,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import type { InstallationRepo } from "../../adapters/github/reposClient";
import type { RecentCommit } from "../../adapters/coreApi/client";
import type { InstallationRow } from "../../lib/accountService";
import { RefreshReposButton } from "./RefreshReposButton";
import { PipelineStageTracker } from "./PipelineStageTracker";
import { RepoProtectionWizardModal } from "./RepoProtectionWizardModal";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

export interface RepoProtectionStatus {
  isProtected: boolean;
  hasWorkflow: boolean;
  mode?: string;
  adapterKind?: string;
  adapterTarget?: string;
}

interface SystemHealthState {
  status: "healthy" | "degraded" | "loading" | "unknown";
  latencyMs?: number;
  coreApiStatus?: string;
  dbStatus?: string;
}

export function OverviewView({
  installation,
  repos,
  commits,
}: {
  installation: InstallationRow;
  repos: InstallationRepo[];
  commits: RecentCommit[];
  accountEmail?: string;
}) {
  const [repoSearch, setRepoSearch] = useState("");
  const [availableSearch, setAvailableSearch] = useState("");
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [protectionMap, setProtectionMap] = useState<Record<string, RepoProtectionStatus>>({});
  const [wizardTargetRepo, setWizardTargetRepo] = useState<InstallationRepo | null>(null);
  const [health, setHealth] = useState<SystemHealthState>({ status: "loading" });
  const [currentTime, setCurrentTime] = useState<number>(0);

  // 1. Load repository protection status from API
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
            const entry: RepoProtectionStatus = {
              isProtected: s.isProtected,
              hasWorkflow: s.hasWorkflow,
              mode: s.mode,
              adapterKind: s.adapterKind,
              adapterTarget: s.adapterTarget,
            };
            map[s.name] = entry;
            map[s.fullName] = entry;
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

  // 2. Poll System Health API
  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (isMounted) {
          setHealth({
            status: data.status === "healthy" ? "healthy" : "degraded",
            latencyMs: data.coreApi?.latencyMs ?? data.latencyMs,
            coreApiStatus: data.coreApi?.status ?? "unknown",
            dbStatus: data.database?.status ?? "unknown",
          });
        }
      } catch {
        if (isMounted) {
          setHealth({ status: "degraded", coreApiStatus: "unreachable" });
        }
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 3. Live timer for active observation windows
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 4. Determine integrated vs unintegrated repositories
  const isRepoIntegrated = useMemo(() => {
    return (repo: InstallationRepo) => {
      const status = protectionMap[repo.name] || protectionMap[repo.full_name];
      if (status?.isProtected || status?.hasWorkflow) return true;
      // Also integrated if commits exist in CARF for this repo
      const hasCommits = commits.some(
        (c) =>
          c.repo.toLowerCase() === repo.name.toLowerCase() ||
          c.repo.toLowerCase() === repo.full_name.toLowerCase()
      );
      return hasCommits;
    };
  }, [protectionMap, commits]);

  // Integrated repos list
  const integratedRepos = useMemo(() => {
    const fromRepos = repos.filter(isRepoIntegrated);
    
    // Check if there are any repos present in commits that weren't in the GitHub repos list
    const knownNames = new Set(fromRepos.map((r) => r.name.toLowerCase()));
    const extraRepos: InstallationRepo[] = [];
    
    for (const commit of commits) {
      if (!commit.repo) continue;
      const rLower = commit.repo.toLowerCase();
      if (!knownNames.has(rLower)) {
        knownNames.add(rLower);
        let hash = 0;
        for (let i = 0; i < commit.repo.length; i++) {
          hash = (hash << 5) - hash + commit.repo.charCodeAt(i);
          hash |= 0;
        }
        extraRepos.push({
          id: Math.abs(hash) || 999999,
          name: commit.repo.includes("/") ? commit.repo.split("/")[1]! : commit.repo,
          full_name: commit.repo.includes("/") ? commit.repo : `${installation.targetLogin}/${commit.repo}`,
          private: false,
          default_branch: "main",
          owner: { login: installation.targetLogin },
        });
      }
    }

    return [...fromRepos, ...extraRepos];
  }, [repos, isRepoIntegrated, commits, installation.targetLogin]);

  // Available / Unintegrated repos list
  const availableRepos = useMemo(() => {
    return repos.filter((r) => !isRepoIntegrated(r));
  }, [repos, isRepoIntegrated]);

  // Filtered integrated repos for search
  const filteredIntegratedRepos = useMemo(() => {
    if (!repoSearch.trim()) return integratedRepos;
    const q = repoSearch.toLowerCase();
    return integratedRepos.filter(
      (r) => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q)
    );
  }, [integratedRepos, repoSearch]);

  // Filtered available repos for search
  const filteredAvailableRepos = useMemo(() => {
    if (!availableSearch.trim()) return availableRepos;
    const q = availableSearch.toLowerCase();
    return availableRepos.filter(
      (r) => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q)
    );
  }, [availableRepos, availableSearch]);

  // 5. Compute live overview metrics
  const totalCommits = commits.length;
  const activeWatchdogs = commits.filter(
    (c) =>
      c.rolledBack === null &&
      c.finalWindow &&
      (currentTime > 0 ? new Date(c.createdAt).getTime() + c.finalWindow * 1000 > currentTime : true)
  ).length;
  const rollbacksTriggered = commits.filter((c) => c.rolledBack === true).length;

  // ── Adapter icon helper ──────────────────────────────────────────────────
  function adapterIcon(kind: string | undefined) {
    switch (kind) {
      case "pm2":          return <Terminal className="size-3.5 shrink-0" />;
      case "dockerCompose":
      case "dockerSwarm":  return <Container className="size-3.5 shrink-0" />;
      case "kubernetes":   return <Server className="size-3.5 shrink-0" />;
      case "gitops":       return <GitBranch className="size-3.5 shrink-0" />;
      default:             return <Sliders className="size-3.5 shrink-0" />;
    }
  }

  function DeploymentBadge({ status }: { status: RepoProtectionStatus | undefined }) {
    if (!status?.isProtected) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <span>Standard Augment</span>
        </span>
      );
    }
    if (status.mode === "augment") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
          <ArrowUpRight className="size-3 shrink-0" />
          <span>Augment Mode</span>
        </span>
      );
    }
    if (status.mode === "standalone" && status.adapterKind) {
      const label =
        status.adapterKind === "pm2" ? "PM2" :
        status.adapterKind === "dockerCompose" ? "Docker Compose" :
        status.adapterKind === "dockerSwarm" ? "Docker Swarm" :
        status.adapterKind === "kubernetes" ? "Kubernetes" :
        status.adapterKind === "gitops" ? "GitOps" :
        status.adapterKind;
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
          title={`Standalone • ${label} → ${status.adapterTarget ?? "—"}`}
        >
          {adapterIcon(status.adapterKind)}
          <span>{label}</span>
          {status.adapterTarget && (
            <span className="font-mono opacity-80">· {status.adapterTarget}</span>
          )}
        </span>
      );
    }
    if (status.mode === "standalone") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3 shrink-0" />
          <span>Standalone (No adapter set)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3 shrink-0" />
        <span>Balanced Protection</span>
      </span>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 md:p-8">
      {/* ── Top Integration Command Header ── */}
      <div className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-xs">
            C
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                @{installation.targetLogin}
              </h1>
              <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                {integratedRepos.length} Integrated {integratedRepos.length === 1 ? "Service" : "Services"}
              </Badge>

              {/* Live Health Indicator Pill */}
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  health.status === "healthy"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                    : health.status === "loading"
                    ? "border-border bg-muted/40 text-muted-foreground"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
                title={
                  health.status === "healthy"
                    ? `Core-API & DB connected (${health.latencyMs ?? 0}ms)`
                    : `Core-API: ${health.coreApiStatus ?? "unknown"} • Database: ${health.dbStatus ?? "unknown"}`
                }
              >
                <span
                  className={`size-2 rounded-full ${
                    health.status === "healthy"
                      ? "bg-emerald-500 animate-pulse"
                      : health.status === "loading"
                      ? "bg-muted-foreground"
                      : "bg-amber-500"
                  }`}
                />
                <span>
                  {health.status === "healthy"
                    ? `Core-API Online (${health.latencyMs ?? 0}ms)`
                    : health.status === "loading"
                    ? "Checking Core-API..."
                    : "Core-API Degraded"}
                </span>
              </div>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Integration #{installation.installationId} • Dynamic error budgets & autonomous rollback active across integrated repositories.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {availableRepos.length > 0 && (
            <button
              type="button"
              onClick={() => setIsConnectOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              <span>Connect Repository ({availableRepos.length})</span>
            </button>
          )}

          <RefreshReposButton size="sm" />

          <a
            href={`https://github.com/settings/installations/${installation.installationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
          >
            <span>GitHub App Settings</span>
            <ExternalLink className="size-3 text-muted-foreground" />
          </a>
        </div>
      </div>

      {/* ── High-Level Cross-Project Metrics ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Integrated Repositories */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Integrated Services
            </span>
            <Layers className="size-4 text-primary/70" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{integratedRepos.length}</span>
            <span className="text-xs text-muted-foreground">monitored</span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {availableRepos.length > 0
              ? `${availableRepos.length} more available in GitHub`
              : "All granted repositories connected"}
          </p>
        </div>

        {/* Metric 2: Total Commits Analyzed */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Commits Analyzed
            </span>
            <Activity className="size-4 text-primary/70" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{totalCommits}</span>
            <span className="text-xs text-muted-foreground">rollouts</span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">AST classified via Tier-1 & Tier-2</p>
        </div>

        {/* Metric 3: Active Watchdogs */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Active Watchdogs
            </span>
            <Radio className="size-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{activeWatchdogs}</span>
            {activeWatchdogs > 0 ? (
              <Badge variant="secondary" className="animate-pulse bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">
                Observing
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">idle</span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {activeWatchdogs > 0
              ? "Actively observing post-deploy health"
              : "No active rollout observation windows"}
          </p>
        </div>

        {/* Metric 4: Outages Prevented */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Prevented Outages
            </span>
            <ShieldCheck className="size-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{rollbacksTriggered}</span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">auto-rollbacks</span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Zero-human intervention triggered</p>
        </div>
      </div>

      {/* ── Active Integrated Services (Primary Operations View) ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                Active Protected Services ({integratedRepos.length})
              </h2>
              <Badge variant="secondary" className="bg-emerald-500/10 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Live Monitored
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Repositories actively configured with CARF AST classification, dynamic error budgets, and rollback watchdogs.
            </p>
          </div>

          {integratedRepos.length > 1 && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search active services..."
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          )}
        </div>

        {/* If no repos are integrated yet */}
        {integratedRepos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
              <ShieldCheck className="size-6 text-muted-foreground/60" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-foreground">No Services Integrated Yet</h3>
            <p className="mt-1.5 max-w-md text-xs text-muted-foreground">
              Your GitHub App is connected, but no repositories have been configured with CARF protection.
              Choose a repository below to enable 1-click autonomous rollbacks.
            </p>
            {availableRepos.length > 0 && (
              <button
                type="button"
                onClick={() => setIsConnectOpen(true)}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
              >
                <Zap className="size-3.5 text-amber-300" />
                <span>Choose Repository to Protect ({availableRepos.length} available)</span>
              </button>
            )}
          </div>
        ) : filteredIntegratedRepos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="size-6 text-muted-foreground/40" />
            <p className="mt-2 text-xs text-muted-foreground">No active service matches &ldquo;{repoSearch}&rdquo;</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {filteredIntegratedRepos.map((repo) => {
              const status = protectionMap[repo.name] || protectionMap[repo.full_name];
              const repoCommits = commits.filter(
                (c) =>
                  c.repo.toLowerCase() === repo.name.toLowerCase() ||
                  c.repo.toLowerCase() === repo.full_name.toLowerCase()
              );
              const latestCommit = repoCommits[0];
              const repoActiveWatchdogs = repoCommits.filter(
                (c) =>
                  c.rolledBack === null &&
                  c.finalWindow &&
                  (currentTime > 0 ? new Date(c.createdAt).getTime() + c.finalWindow * 1000 > currentTime : true)
              ).length;
              const repoRollbacks = repoCommits.filter((c) => c.rolledBack === true).length;
              const repoAvgBudget =
                repoCommits.length > 0
                  ? (
                      (repoCommits.reduce((acc, c) => acc + (c.finalThreshold ?? 0.05), 0) /
                        repoCommits.length) *
                      100
                    ).toFixed(1)
                  : "—";

              return (
                <div
                  key={repo.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card/60 p-5 shadow-xs transition-all hover:border-border/80 hover:shadow-sm"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground">
                          <FolderGit2 className="size-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{repo.name}</span>
                            <span className="rounded border border-border bg-muted/40 px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                              {repo.default_branch}
                            </span>
                            {repo.private && (
                              <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400">
                                <Lock className="size-2.5" />
                                Private
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{repo.full_name}</p>
                        </div>
                      </div>

                      {/* Watchdog / Rollback status badge */}
                      {repoActiveWatchdogs > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
                          <Radio className="size-3" />
                          <span>Watchdog Active</span>
                        </span>
                      ) : repoRollbacks > 0 && latestCommit?.rolledBack ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                          <AlertTriangle className="size-3" />
                          <span>Rollback Executed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          <span>Monitored Clean</span>
                        </span>
                      )}
                    </div>

                    {/* Operational Telemetry Grid */}
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/25 p-3 text-xs">
                      <div>
                        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                          Deployment Adapter
                        </span>
                        <div className="mt-1">
                          <DeploymentBadge status={status} />
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                          Dynamic Error Budget
                        </span>
                        <p className="mt-1 font-mono text-xs font-medium text-foreground">
                          {latestCommit?.finalThreshold != null
                            ? `${(latestCommit.finalThreshold * 100).toFixed(1)}% ceiling`
                            : repoAvgBudget !== "—"
                            ? `${repoAvgBudget}% avg ceiling`
                            : "AST Calibrated"}
                        </p>
                      </div>

                      <div className="col-span-2 border-t border-border/40 pt-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Latest Rollout
                          </span>
                          {latestCommit && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {new Date(latestCommit.createdAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                        {latestCommit ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground border border-border">
                              {latestCommit.sha.slice(0, 7)}
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {latestCommit.activeTypes && latestCommit.activeTypes.length > 0 ? (
                                latestCommit.activeTypes.map((t) => (
                                  <span
                                    key={t}
                                    className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground capitalize"
                                  >
                                    {t}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-muted-foreground">code changes</span>
                              )}
                            </div>
                            {latestCommit.rolledBack === true && (
                              <span className="text-[10px] font-bold text-red-600 dark:text-red-400">
                                (Auto-Rolled Back)
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Waiting for first commit rollout via GitHub webhook.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3.5">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span><strong>{repoCommits.length}</strong> commits</span>
                      <span>•</span>
                      <span><strong>{repoRollbacks}</strong> rollbacks</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWizardTargetRepo(repo)}
                        className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        title="Reconfigure CARF Protection"
                      >
                        Settings
                      </button>

                      <Link
                        href={`/dashboard/config/${installation.installationId}`}
                        className="rounded-lg border border-border bg-background p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Configure Adapter & Rules"
                      >
                        <Sliders className="size-3.5" />
                      </Link>

                      <Link
                        href={`/dashboard/status/${installation.installationId}?repo=${encodeURIComponent(repo.name)}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                      >
                        <span>Live Commits &rarr;</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Connect More Repositories (Collapsible / Non-Intrusive Drawer) ── */}
      {availableRepos.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Available GitHub Repositories ({availableRepos.length})
                </h2>
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  Unintegrated
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Repositories accessible by the GitHub App that are not yet configured for CARF monitoring.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsConnectOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span>{isConnectOpen ? "Hide Repositories" : "Show Available Repositories"}</span>
              {isConnectOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </div>

          {isConnectOpen && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search available repositories..."
                    value={availableSearch}
                    onChange={(e) => setAvailableSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  Showing {filteredAvailableRepos.length} of {availableRepos.length} repositories
                </span>
              </div>

              {filteredAvailableRepos.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No unintegrated repositories match &ldquo;{availableSearch}&rdquo;
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 text-xs hover:bg-muted/40">
                        <TableHead className="py-2.5">Repository</TableHead>
                        <TableHead className="py-2.5">Default Branch</TableHead>
                        <TableHead className="py-2.5">Visibility</TableHead>
                        <TableHead className="py-2.5 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAvailableRepos.map((repo) => (
                        <TableRow key={repo.id} className="text-xs hover:bg-muted/30">
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              <FolderGit2 className="size-3.5 text-muted-foreground" />
                              <span className="font-semibold text-foreground">{repo.name}</span>
                              <span className="font-mono text-[11px] text-muted-foreground">({repo.full_name})</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 font-mono text-[11px] text-muted-foreground">
                            {repo.default_branch}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {repo.private ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                <Lock className="size-2.5" />
                                Private
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Public</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setWizardTargetRepo(repo)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                            >
                              <Zap className="size-3 text-primary" />
                              <span>1-Click Protect</span>
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Global Cross-Project Live Rollouts Feed ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Live Rollout Pipeline</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recent classified commits and active watchdogs across your integrated services.
            </p>
          </div>
          <Link
            href={`/dashboard/status/${installation.installationId}`}
            className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
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
