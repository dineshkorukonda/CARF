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

type RepoFilterTab = "all" | "protected" | "unconfigured" | "private";

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
  const [activeTab, setActiveTab] = useState<RepoFilterTab>("all");
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

  // 4. Tab counts & Filtering
  const protectedCount = useMemo(() => {
    return repos.filter((r) => protectionMap[r.name]?.isProtected || protectionMap[r.full_name]?.isProtected).length;
  }, [repos, protectionMap]);

  const unconfiguredCount = repos.length - protectedCount;
  const privateCount = useMemo(() => repos.filter((r) => r.private).length, [repos]);

  const filteredRepos = useMemo(() => {
    let result = repos;

    // Filter by Tab
    if (activeTab === "protected") {
      result = result.filter((r) => protectionMap[r.name]?.isProtected || protectionMap[r.full_name]?.isProtected);
    } else if (activeTab === "unconfigured") {
      result = result.filter((r) => !protectionMap[r.name]?.isProtected && !protectionMap[r.full_name]?.isProtected);
    } else if (activeTab === "private") {
      result = result.filter((r) => r.private);
    }

    // Filter by Search
    if (repoSearch.trim()) {
      const q = repoSearch.toLowerCase();
      result = result.filter(
        (r) => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [repos, protectionMap, activeTab, repoSearch]);

  // 5. Compute live overview metrics
  const totalCommits = commits.length;
  const activeWatchdogs = commits.filter(
    (c) =>
      c.rolledBack === null &&
      c.finalWindow &&
      (currentTime > 0 ? new Date(c.createdAt).getTime() + c.finalWindow * 1000 > currentTime : true)
  ).length;
  const rollbacksTriggered = commits.filter((c) => c.rolledBack === true).length;
  const avgThreshold =
    totalCommits > 0
      ? (
          (commits.reduce((acc, c) => acc + (c.finalThreshold ?? 0.05), 0) / totalCommits) *
          100
        ).toFixed(1)
      : "5.0";

  // ── Adapter icon helper ──────────────────────────────────────────────────
  function adapterIcon(kind: string | undefined) {
    switch (kind) {
      case "pm2":          return <Terminal className="size-3 shrink-0" />;
      case "dockerCompose":
      case "dockerSwarm":  return <Container className="size-3 shrink-0" />;
      case "kubernetes":   return <Server className="size-3 shrink-0" />;
      case "gitops":       return <GitBranch className="size-3 shrink-0" />;
      default:             return null;
    }
  }

  function DeploymentBadge({ status }: { status: RepoProtectionStatus | undefined }) {
    if (!status?.isProtected) {
      return <span className="font-mono text-[11px] text-muted-foreground/60">—</span>;
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
          <span>No adapter set</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        <span>{status.mode ?? "Default"}</span>
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
                Protected Workspace
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
                    : "Connectivity warning"
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
              Integration #{installation.installationId} • {repos.length} total repositories connected • Autonomous change-aware rollback active
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
        {/* Metric 1: Total Commits Analyzed */}
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

        {/* Metric 2: Active Watchdogs */}
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

        {/* Metric 3: Outages Prevented */}
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

        {/* Metric 4: Avg Dynamic Budget */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Avg Dynamic Budget
            </span>
            <Zap className="size-4 text-indigo-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">{avgThreshold}%</span>
            <span className="text-xs text-muted-foreground">error ceiling</span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Calibrated to code churn risk</p>
        </div>
      </div>

      {/* ── Protected Repositories Directory ── */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-base font-bold text-foreground">Repositories ({repos.length})</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Repositories monitored by CARF for dynamic error budgets and automated rollbacks.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Filter Tabs */}
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  activeTab === "all"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({repos.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("protected")}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  activeTab === "protected"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Protected ({protectedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unconfigured")}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  activeTab === "unconfigured"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Needs Setup ({unconfiguredCount})
              </button>
              {privateCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("private")}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    activeTab === "private"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Private ({privateCount})
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search repositories..."
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </div>

        {filteredRepos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderGit2 className="size-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-foreground">No repositories found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {repoSearch ? `No matches for "${repoSearch}".` : "No repositories in this category."}
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs font-medium hover:bg-muted/40">
                  <TableHead className="py-3">Repository</TableHead>
                  <TableHead className="py-3">Default Branch</TableHead>
                  <TableHead className="py-3">Protection Status</TableHead>
                  <TableHead className="py-3">Deployment Adapter</TableHead>
                  <TableHead className="py-3">Last Push</TableHead>
                  <TableHead className="py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRepos.map((repo) => {
                  const status = protectionMap[repo.name] || protectionMap[repo.full_name];
                  const isProtected = status?.isProtected ?? false;

                  return (
                    <TableRow key={repo.id} className="text-xs transition-colors hover:bg-muted/30">
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-xs">{repo.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">{repo.full_name}</span>
                          </div>
                          {repo.private && (
                            <Badge variant="outline" className="ml-1 gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400">
                              <Lock className="size-2.5" />
                              Private
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5">
                        <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-foreground">
                          {repo.default_branch}
                        </span>
                      </TableCell>

                      <TableCell className="py-3.5">
                        {isProtected ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3 shrink-0" />
                            <span>Protected (.carf.yml active)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                            <span>Unconfigured (Default Rules)</span>
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5">
                        <DeploymentBadge status={status} />
                      </TableCell>

                      <TableCell className="py-3.5 font-mono text-[11px] text-muted-foreground">
                        {repo.pushed_at ? new Date(repo.pushed_at).toLocaleDateString() : "--"}
                      </TableCell>

                      <TableCell className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/status/${installation.installationId}?repo=${encodeURIComponent(repo.name)}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                          >
                            <span>Live Commits &rarr;</span>
                          </Link>

                          {isProtected ? (
                            <button
                              type="button"
                              onClick={() => setWizardTargetRepo(repo)}
                              className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                              title="Update CARF configuration"
                            >
                              Reprotect
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setWizardTargetRepo(repo)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-500/20 dark:text-amber-400 transition-colors"
                            >
                              <Zap className="size-3 text-amber-500" />
                              <span>1-Click Protect</span>
                            </button>
                          )}

                          <Link
                            href={`/dashboard/config/${installation.installationId}`}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Configure Adapter & Rules"
                          >
                            <Sliders className="size-3.5" />
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Global Cross-Project Live Rollouts Feed ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Live Rollout Pipeline</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recent classified commits and active watchdogs across all protected repositories.
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
