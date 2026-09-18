"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  RefreshCw,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  Layers,
  TableProperties,
  FolderGit2,
  Search,
  ArrowLeft,
  Terminal,
  Container,
  Server,
  GitBranch,
  ArrowUpRight,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import type { RecentCommit } from "../../../../adapters/coreApi/client";
import type { InstallationRepo } from "../../../../adapters/github/reposClient";
import { classifyRolloutOutcome } from "../../../../lib/outcomeClassifier";
import { PipelineStageTracker } from "../../PipelineStageTracker";
import { LinkProjectModal } from "./LinkProjectModal";
import { UnlinkConfirmModal } from "./UnlinkConfirmModal";

const POLL_INTERVAL_MS = 15_000;

function formatWindow(seconds: number | null): string {
  if (!seconds) return "--";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${seconds}s (${minutes}m)`;
}

// ── Shared adapter label / icon helpers ──────────────────────────────────────
function adapterLabel(kind: string | undefined): string {
  switch (kind) {
    case "pm2":          return "PM2 Process Manager";
    case "dockerCompose": return "Docker Compose";
    case "dockerSwarm":  return "Docker Swarm";
    case "kubernetes":   return "Kubernetes (kubectl)";
    case "gitops":       return "GitOps (Argo CD)";
    default:             return kind ?? "Unknown";
  }
}

function adapterIcon(kind: string | undefined, className = "size-3 shrink-0") {
  switch (kind) {
    case "pm2":           return <Terminal className={className} />;
    case "dockerCompose":
    case "dockerSwarm":   return <Container className={className} />;
    case "kubernetes":    return <Server className={className} />;
    case "gitops":        return <GitBranch className={className} />;
    default:              return null;
  }
}

interface DeploymentInfo {
  mode?: string;
  adapterKind?: string;
  adapterTarget?: string;
  isProtected?: boolean;
}

function DeploymentBadge({ info }: { info: DeploymentInfo | undefined }) {
  if (!info?.isProtected) {
    return <span className="text-slate-400 font-mono text-[11px]">—</span>;
  }
  if (info.mode === "augment") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
        <ArrowUpRight className="size-3 shrink-0" />
        <span>Augment</span>
      </span>
    );
  }
  if (info.mode === "standalone" && info.adapterKind) {
    const short =
      info.adapterKind === "pm2" ? "PM2" :
      info.adapterKind === "dockerCompose" ? "Docker Compose" :
      info.adapterKind === "dockerSwarm" ? "Docker Swarm" :
      info.adapterKind === "kubernetes" ? "Kubernetes" :
      info.adapterKind === "gitops" ? "GitOps" :
      info.adapterKind;
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700"
        title={`Standalone • ${short} → ${info.adapterTarget ?? "—"}`}
      >
        {adapterIcon(info.adapterKind)}
        <span>{short}</span>
        {info.adapterTarget && (
          <span className="font-mono text-emerald-600 opacity-75">· {info.adapterTarget}</span>
        )}
      </span>
    );
  }
  if (info.mode === "standalone") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
        <AlertTriangle className="size-3 shrink-0" />
        <span>No adapter</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
      <span>{info.mode ?? "Default"}</span>
    </span>
  );
}

function rollbackCommand(kind: string | undefined, target: string, previousSha = "<baseSha>"): string {
  switch (kind) {
    case "pm2":
      return `ln -sfn /var/www/releases/${previousSha} /var/www/current\npm2 reload ${target}`;
    case "dockerCompose":
      return `IMAGE_TAG=${previousSha} docker compose up -d ${target}`;
    case "dockerSwarm":
      return `docker service update --rollback ${target}`;
    case "kubernetes":
      return `kubectl rollout undo deployment/${target}`;
    case "gitops":
      return `argocd app rollback ${target}`;
    default:
      return "—";
  }
}

function ecosystemSnippet(kind: string | undefined, target: string): string | null {
  if (kind === "pm2") {
    return `// ecosystem.config.js
module.exports = {
  apps: [{
    name: "${target}",
    script: "/var/www/current/dist/index.js",
    instances: "max",   // cluster mode — zero-downtime pm2 reload
    exec_mode: "cluster",
    watch: false,
    env_production: { NODE_ENV: "production" }
  }]
};`;
  }
  if (kind === "dockerCompose") {
    return `# docker-compose.yml (relevant snippet)
services:
  ${target}:
    image: my-registry.com/app:\${IMAGE_TAG:-latest}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3`;
  }
  return null;
}

function FaultTolerancePanel({
  info,
  installationId,
  fullName,
}: {
  info: DeploymentInfo | undefined;
  installationId: string;
  fullName: string;
}) {
  const [showSnippet, setShowSnippet] = useState(false);
  const configHref = `/dashboard/config/${installationId}?repo=${encodeURIComponent(fullName)}`;

  // ── Unconfigured ──────────────────────────────────────────────────────────
  if (!info?.isProtected) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Fault Tolerance Not Configured</p>
            <p className="mt-1 text-xs text-amber-700 leading-relaxed">
              No <code className="font-mono bg-amber-100 px-1 rounded">.carf.yml</code> found in this
              repository. CARF is watching with built-in defaults but cannot trigger automatic
              rollbacks without a deployment adapter.
            </p>
            <a
              href={configHref}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              Configure Adapter &rarr;
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Augment Mode ──────────────────────────────────────────────────────────
  if (info.mode === "augment") {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
        <div className="flex items-start gap-3">
          <ArrowUpRight className="size-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-blue-900">Augment Mode Active</p>
              <span className="rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700">External Orchestrator</span>
            </div>
            <p className="mt-1 text-xs text-blue-700 leading-relaxed">
              CARF provides dynamic risk thresholds. Your CI/CD pipeline (Argo Rollouts, Flagger,
              GitHub Actions) queries the threshold and drives rollback independently.
            </p>
            <div className="mt-3 rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-400 break-all select-all">
              curl -s &quot;https://carf.indevs.in/v1/threshold?commit=$SHA&quot;
            </div>
            <p className="mt-2 text-[11px] text-blue-600">
              Point Argo Rollouts / Flagger / your CI script at this endpoint.{" "}
              <a href={configHref} className="underline underline-offset-2 font-medium">Switch to Standalone</a> to let CARF drive rollback directly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Standalone — no adapter ───────────────────────────────────────────────
  if (info.mode === "standalone" && !info.adapterKind) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Standalone Mode — Adapter Not Set</p>
            <p className="mt-1 text-xs text-amber-700 leading-relaxed">
              <code className="font-mono bg-amber-100 px-1 rounded">.carf.yml</code> sets{" "}
              <code className="font-mono bg-amber-100 px-1 rounded">mode: standalone</code> but
              no <code className="font-mono bg-amber-100 px-1 rounded">adapter.kind</code> is
              configured. CARF cannot trigger automatic rollbacks without a target.
            </p>
            <a
              href={configHref}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              Set Deployment Adapter &rarr;
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Standalone + adapter fully configured ────────────────────────────────
  if (info.mode === "standalone" && info.adapterKind) {
    const target = info.adapterTarget ?? "<target>";
    const rbCmd = rollbackCommand(info.adapterKind, target);
    const snippet = ecosystemSnippet(info.adapterKind, target);
    const label = adapterLabel(info.adapterKind);

    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-emerald-900">Fault Tolerance Active</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                {adapterIcon(info.adapterKind, "size-3")}
                <span>{label}</span>
              </span>
              {info.adapterTarget && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                  target: {info.adapterTarget}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-emerald-700 leading-relaxed">
              CARF is running in Standalone mode. If the error rate breaches the dynamic threshold
              during the observation window, CARF automatically executes the rollback command below
              with zero human intervention.
            </p>
          </div>
        </div>

        {/* How it works grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg bg-white border border-emerald-100 p-3 space-y-1">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Info className="size-3.5 text-slate-500" /> Health Check
            </p>
            <p className="text-slate-500 leading-relaxed">
              {info.adapterKind === "pm2"
                ? "pm2 jlist — fraction of processes with status ≠ \"online\""
                : info.adapterKind === "dockerCompose"
                ? "docker compose ps — unhealthy / exited containers"
                : info.adapterKind === "dockerSwarm"
                ? "docker service ps — failed task replicas"
                : info.adapterKind === "kubernetes"
                ? "kubectl rollout status — unavailable replicas"
                : "Adapter-specific health probe"}
            </p>
          </div>
          <div className="rounded-lg bg-white border border-emerald-100 p-3 space-y-1">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Clock className="size-3.5 text-slate-500" /> Observation Window
            </p>
            <p className="text-slate-500 leading-relaxed">
              Dynamic — calibrated per commit by AST diff scoring. Low-risk commits get
              a short window; infra changes get a longer soak.
            </p>
          </div>
          <div className="rounded-lg bg-white border border-emerald-100 p-3 space-y-1">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" /> Zero Downtime
            </p>
            <p className="text-slate-500 leading-relaxed">
              {info.adapterKind === "pm2"
                ? "pm2 reload cycles cluster workers one-by-one — no dropped requests"
                : info.adapterKind === "dockerCompose"
                ? "Image tag swap restarts only the affected service"
                : info.adapterKind === "kubernetes"
                ? "kubectl rollout undo restores previous ReplicaSet"
                : "Adapter handles rollback atomically"}
            </p>
          </div>
        </div>

        {/* Rollback command */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Automated Rollback Command (on threshold breach):</p>
          <pre className="rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap">
            {rbCmd}
          </pre>
        </div>

        {/* Ecosystem / compose snippet (collapsible) */}
        {snippet && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setShowSnippet((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              {showSnippet ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              <span>
                {info.adapterKind === "pm2" ? "ecosystem.config.js" : "docker-compose.yml"} snippet
              </span>
            </button>
            {showSnippet && (
              <pre className="rounded-lg bg-slate-100 border border-slate-200 p-3 font-mono text-[11px] text-slate-800 overflow-x-auto whitespace-pre">
                {snippet}
              </pre>
            )}
          </div>
        )}

        <div className="pt-1 border-t border-emerald-100 flex items-center justify-between">
          <p className="text-[11px] text-emerald-600">
            CARF monitors every push to this repo and auto-rolls back if needed.
          </p>
          <a
            href={configHref}
            className="text-[11px] font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 transition-colors"
          >
            Edit configuration →
          </a>
        </div>
      </div>
    );
  }

  // Fallback for legacy modes (balanced / conservative / aggressive)
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
      <Info className="size-4 text-slate-400 shrink-0" />
      <p className="text-xs text-slate-500">
        Mode: <span className="font-mono font-medium text-slate-700">{info.mode ?? "balanced"}</span> —
        this is a legacy threshold-only mode. No adapter is configured for automatic rollbacks.{" "}
        <a href={configHref} className="underline underline-offset-2 font-medium text-slate-700">
          Upgrade to Standalone →
        </a>
      </p>
    </div>
  );
}

export function StatusTable({
  installationId,
  initial,
  repos = [],
  initialRepoFilter,
}: {
  installationId: string;
  initial: RecentCommit[];
  repos?: InstallationRepo[];
  initialRepoFilter?: string;
}) {
  const [commits, setCommits] = useState<RecentCommit[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedRepoFilter, setSelectedRepoFilter] = useState<string>(initialRepoFilter || "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "observing" | "healthy" | "rolled_back">("all");
  const [viewMode, setViewMode] = useState<"pipeline" | "table">("table");
  const [showLegend, setShowLegend] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [unlinkTargetRepo, setUnlinkTargetRepo] = useState<{ owner: string; name: string; fullName: string } | null>(null);

  // ── Deployment / fault-tolerance info keyed by repo fullName or name ──────
  const [deploymentMap, setDeploymentMap] = useState<Record<string, DeploymentInfo>>({});

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch repo protection + adapter info
  const loadDeployment = useCallback(async () => {
    try {
      const res = await fetch(`/api/repo/status?installationId=${installationId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.statuses && Array.isArray(data.statuses)) {
        const map: Record<string, DeploymentInfo> = {};
        for (const s of data.statuses) {
          const entry: DeploymentInfo = {
            mode: s.mode,
            adapterKind: s.adapterKind,
            adapterTarget: s.adapterTarget,
            isProtected: s.isProtected,
          };
          map[s.name] = entry;
          map[s.fullName] = entry;
        }
        setDeploymentMap(map);
      }
    } catch {
      // Non-fatal — deployment column just shows no info
    }
  }, [installationId]);

  useEffect(() => {
    loadDeployment();
  }, [loadDeployment]);

  const fetchStatus = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/status/${installationId}`);
      if (!response.ok) {
        setError("Couldn't refresh status.");
        return;
      }
      const body = (await response.json()) as { commits: RecentCommit[] };
      setCommits(body.commits);
      setError(null);
      setLastUpdated(new Date());
    } catch {
      setError("Couldn't refresh status.");
    } finally {
      setIsRefreshing(false);
    }
  }, [installationId]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Merge projects from repos list and commits
  const projects = useMemo(() => {
    const map = new Map<
      string,
      {
        fullName: string;
        name: string;
        owner?: string;
        defaultBranch?: string;
        isPrivate?: boolean;
        pushedAt?: string | null;
        commits: RecentCommit[];
      }
    >();

    // Add all repositories from GitHub integration
    repos.forEach((r) => {
      map.set(r.full_name, {
        fullName: r.full_name,
        name: r.name,
        owner: r.owner.login,
        defaultBranch: r.default_branch,
        isPrivate: r.private,
        pushedAt: r.pushed_at,
        commits: [],
      });
    });

    // Populate commits and discovered repos
    commits.forEach((c) => {
      if (c.owner && c.repo) {
        const fullName = `${c.owner}/${c.repo}`;
        if (!map.has(fullName)) {
          map.set(fullName, {
            fullName,
            name: c.repo,
            owner: c.owner,
            commits: [],
          });
        }
        map.get(fullName)!.commits.push(c);
      }
    });

    return Array.from(map.values()).map((p) => {
      // Sort commits by creation date descending
      p.commits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const totalCommits = p.commits.length;
      const rolledBackCount = p.commits.filter((c) => c.rolledBack === true).length;
      const healthyCount = p.commits.filter((c) => c.rolledBack === false).length;

      const activeWatchdogs = p.commits.filter((c) => {
        const outcome = classifyRolloutOutcome(c);
        return (
          outcome.kind === "pending" &&
          c.finalWindow &&
          (currentTime > 0 ? new Date(c.createdAt).getTime() + c.finalWindow * 1000 > currentTime : true)
        );
      }).length;

      const latestCommit = p.commits[0];
      const latestOutcome = latestCommit ? classifyRolloutOutcome(latestCommit) : null;

      return {
        ...p,
        totalCommits,
        rolledBackCount,
        healthyCount,
        activeWatchdogs,
        latestCommit,
        latestOutcome,
      };
    });
  }, [repos, commits, currentTime]);

  // Only show projects that are linked to CARF (.carf.yml active or recorded commits)
  const linkedProjects = useMemo(() => {
    return projects.filter((p) => {
      const isProt = deploymentMap[p.fullName]?.isProtected ?? deploymentMap[p.name]?.isProtected;
      return isProt === true || p.totalCommits > 0;
    });
  }, [projects, deploymentMap]);

  // Unlinked repositories available for adding
  const unlinkedRepos = useMemo(() => {
    return repos.filter((r) => {
      const isProt = deploymentMap[r.full_name]?.isProtected ?? deploymentMap[r.name]?.isProtected;
      return isProt !== true;
    });
  }, [repos, deploymentMap]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return linkedProjects;
    const q = searchQuery.toLowerCase();
    return linkedProjects.filter((p) => p.name.toLowerCase().includes(q) || p.fullName.toLowerCase().includes(q));
  }, [linkedProjects, searchQuery]);

  // Filter commits based on selected project and status
  const filteredCommits = useMemo(() => {
    return commits.filter((c) => {
      if (selectedRepoFilter !== "all") {
        const matchesFullName = `${c.owner}/${c.repo}`.toLowerCase() === selectedRepoFilter.toLowerCase();
        const matchesName = c.repo.toLowerCase() === selectedRepoFilter.toLowerCase();
        if (!matchesFullName && !matchesName) return false;
      }

      if (statusFilter !== "all") {
        const outcome = classifyRolloutOutcome(c);
        const isObserving =
          outcome.kind === "pending" &&
          c.finalWindow &&
          (currentTime > 0 ? new Date(c.createdAt).getTime() + c.finalWindow * 1000 > currentTime : true);

        if (statusFilter === "observing" && !isObserving) return false;
        if (statusFilter === "healthy" && outcome.kind !== "healthy") return false;
        if (statusFilter === "rolled_back" && outcome.kind !== "rolled_back") return false;
      }

      return true;
    });
  }, [commits, selectedRepoFilter, statusFilter, currentTime]);

  const activeProject = useMemo(() => {
    if (selectedRepoFilter === "all") return null;
    return projects.find(
      (p) =>
        p.fullName.toLowerCase() === selectedRepoFilter.toLowerCase() ||
        p.name.toLowerCase() === selectedRepoFilter.toLowerCase()
    );
  }, [projects, selectedRepoFilter]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── CASE 1: All Projects Mode ── */}
      {selectedRepoFilter === "all" ? (
        <>
          {/* Projects Directory Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FolderGit2 className="size-4 text-slate-700" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Linked Projects ({linkedProjects.length})
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Active repositories configured with CARF fault tolerance and change-aware canary telemetry.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {linkedProjects.length > 2 && (
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-slate-50/70 pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs shrink-0"
                >
                  <Plus className="size-3.5" />
                  <span>Link Project</span>
                </button>
              </div>
            </div>

            {linkedProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center my-4 space-y-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FolderGit2 className="size-6 text-slate-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">No Linked Projects Yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Link a GitHub repository to configure deployment adapters (PM2, Docker Compose, Kubernetes) and start tracking fault-tolerant rollouts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <Plus className="size-3.5" />
                  <span>Link Your First Project</span>
                </button>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No linked projects found matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 text-xs text-slate-700">
                      <TableHead>Project / Repository</TableHead>
                      <TableHead>Default Branch</TableHead>
                      <TableHead>Total Commits</TableHead>
                      <TableHead>Live Health & Watchdogs</TableHead>
                      <TableHead>Deployment</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((p) => (
                      <TableRow
                        key={p.fullName}
                        onClick={() => setSelectedRepoFilter(p.fullName)}
                        className="text-xs border-b border-slate-100 last:border-0 hover:bg-slate-50/70 cursor-pointer"
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <FolderGit2 className="size-4 text-slate-400 shrink-0" />
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900 text-xs">{p.name}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{p.fullName}</span>
                            </div>
                            {p.isPrivate && (
                              <span className="ml-1.5 rounded bg-amber-50 border border-amber-200 px-1 py-0.2 text-[9px] font-medium text-amber-700">
                                Private
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-700">
                            {p.defaultBranch || "main"}
                          </span>
                        </TableCell>

                        <TableCell className="py-3 font-mono text-xs text-slate-700 font-medium">
                          {p.totalCommits}
                        </TableCell>

                        <TableCell className="py-3">
                          {p.activeWatchdogs > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                              <Clock className="size-3 animate-spin" />
                              <span>Watchdog Active ({p.activeWatchdogs})</span>
                            </span>
                          ) : p.rolledBackCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                              <AlertTriangle className="size-3" />
                              <span>{p.rolledBackCount} rolled back</span>
                            </span>
                          ) : p.totalCommits > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                              <CheckCircle2 className="size-3" />
                              <span>All Clean</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">No rollouts</span>
                          )}
                        </TableCell>

                        <TableCell className="py-3">
                          <DeploymentBadge
                            info={deploymentMap[p.fullName] ?? deploymentMap[p.name]}
                          />
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRepoFilter(p.fullName);
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                            >
                              <span>View Commits &rarr;</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const [owner, repoName] = p.fullName.includes("/") ? p.fullName.split("/") : [p.owner || "", p.name];
                                setUnlinkTargetRepo({ owner: owner || "", name: repoName || p.name, fullName: p.fullName });
                              }}
                              title={`Unlink ${p.fullName} from CARF`}
                              className="inline-flex items-center justify-center size-6.5 rounded-md border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Global Commits Stream Header & Filters */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
                  <span className="text-xs font-semibold text-slate-900">
                    Global Stream (All Commits)
                  </span>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      viewMode === "table"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <TableProperties className="size-3.5" />
                    <span>Table View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("pipeline")}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      viewMode === "pipeline"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Layers className="size-3.5" />
                    <span>Pipeline View</span>
                  </button>
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      statusFilter === "all"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All ({filteredCommits.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("healthy")}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      statusFilter === "healthy"
                        ? "bg-emerald-700 text-white"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    Clean
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("rolled_back")}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      statusFilter === "rolled_back"
                        ? "bg-rose-700 text-white"
                        : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                    }`}
                  >
                    Rolled Back
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                  Updated {lastUpdated.toLocaleTimeString()} · poll {POLL_INTERVAL_MS / 1000}s
                  {error && <span className="text-rose-600"> ({error})</span>}
                </p>

                <button
                  type="button"
                  onClick={() => setShowLegend((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <HelpCircle className="size-3" />
                  <span>{showLegend ? "Hide Guide" : "Guide"}</span>
                </button>

                <button
                  type="button"
                  onClick={fetchStatus}
                  disabled={isRefreshing}
                  title="Refresh status now"
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                >
                  <RefreshCw className={`size-3 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span>{isRefreshing ? "Polling…" : "Refresh"}</span>
                </button>
              </div>
            </div>

            {/* Commits Content */}
            {viewMode === "pipeline" ? (
              <PipelineStageTracker
                commits={filteredCommits}
                emptyMessage="No commits recorded for the selected filter."
              />
            ) : filteredCommits.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
                <p className="text-xs text-slate-500">No commits recorded for the selected filter.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 text-xs text-slate-700">
                      <TableHead className="font-mono">Commit</TableHead>
                      <TableHead>Change Types</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Rollout Outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommits.map((c) => {
                      const outcome = classifyRolloutOutcome(c);

                      return (
                        <TableRow key={c.sha} className="text-xs border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <TableCell className="font-mono text-xs py-3">
                            <div className="flex flex-col gap-0.5">
                              <a
                                href={`https://github.com/${c.owner}/${c.repo}/commit/${c.sha}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline underline-offset-2"
                                title={`Open commit ${c.sha} on GitHub`}
                              >
                                <span>
                                  {c.owner}/{c.repo}@{c.sha.slice(0, 7)}
                                </span>
                                <ExternalLink className="size-3 shrink-0 opacity-40" />
                              </a>
                              <span className="text-[11px] text-slate-500">
                                {new Date(c.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="py-3">
                            <div className="flex flex-wrap gap-1">
                              {c.activeTypes.length === 0 ? (
                                <span className="text-[11px] text-slate-400 font-mono">None</span>
                              ) : (
                                c.activeTypes.map((t) => (
                                  <Badge key={t} variant="secondary" className="text-[10px] font-mono px-1.5 py-0 capitalize bg-slate-100 text-slate-700">
                                    {t}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="py-3">
                            {c.finalThreshold === null || c.finalThreshold === undefined ? (
                              <span className="text-[11px] text-slate-400">--</span>
                            ) : !Number.isFinite(c.finalThreshold) ? (
                              <span className="text-[11px] text-slate-400 font-mono">No signal (∞)</span>
                            ) : (
                              <span
                                title={`Exact calculated limit: ${c.finalThreshold}`}
                                className="font-mono text-xs font-semibold text-slate-900"
                              >
                                {(c.finalThreshold * 100).toFixed(2)}%
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="font-mono text-xs py-3 text-slate-700">
                            {formatWindow(c.finalWindow)}
                          </TableCell>

                          <TableCell className="py-3">
                            {outcome.kind === "healthy" && (
                              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium" title={outcome.description}>
                                <CheckCircle2 className="size-3" />
                                <span>{outcome.label}</span>
                              </div>
                            )}

                            {outcome.kind === "rolled_back" && (
                              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium" title={outcome.description}>
                                <AlertTriangle className="size-3" />
                                <span>
                                  {outcome.label}
                                  {outcome.errorRate !== undefined && ` (${(outcome.errorRate * 100).toFixed(1)}% err)`}
                                </span>
                              </div>
                            )}

                            {outcome.kind === "no_signal" && (
                              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px]" title={outcome.description}>
                                <Ban className="size-3 opacity-60" />
                                <span>{outcome.label}</span>
                              </div>
                            )}

                            {outcome.kind === "pending" && (
                              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px]" title={outcome.description}>
                                <Clock className="size-3" />
                                <span>{outcome.label}</span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── CASE 2: Single Project Selected Mode (Commits Top Level) ── */
        <div className="flex flex-col gap-6">
          {/* Top Dedicated Project Header */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedRepoFilter("all")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-2"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>&larr; Back to all projects</span>
                </button>
                <div className="flex flex-wrap items-center gap-2.5">
                  <FolderGit2 className="size-5 text-slate-800 shrink-0" />
                  <h1 className="text-lg font-bold text-slate-900">
                    {activeProject ? activeProject.fullName : selectedRepoFilter}
                  </h1>
                  {activeProject?.defaultBranch && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-700">
                      {activeProject.defaultBranch}
                    </span>
                  )}
                  {activeProject?.isPrivate && (
                    <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[10px] font-medium text-amber-700">
                      Private
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                  Updated {lastUpdated.toLocaleTimeString()} · poll {POLL_INTERVAL_MS / 1000}s
                </p>
                <button
                  type="button"
                  onClick={() => setShowLegend((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <HelpCircle className="size-3" />
                  <span>{showLegend ? "Hide Guide" : "Guide"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fullName = activeProject ? activeProject.fullName : selectedRepoFilter;
                    const [owner, repoName] = fullName.includes("/")
                      ? fullName.split("/")
                      : [activeProject?.owner || "", activeProject?.name || fullName];
                    setUnlinkTargetRepo({ owner: owner || "", name: repoName || fullName, fullName });
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50/50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-colors"
                >
                  <Trash2 className="size-3" />
                  <span>Unlink</span>
                </button>
                <button
                  type="button"
                  onClick={fetchStatus}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                >
                  <RefreshCw className={`size-3 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span>{isRefreshing ? "Polling…" : "Refresh"}</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar for Selected Project */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
              <div className="rounded-lg bg-slate-50/80 p-3">
                <span className="text-[11px] text-slate-500 font-medium">Total Commits</span>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{filteredCommits.length}</p>
              </div>
              <div className="rounded-lg bg-emerald-50/50 p-3 border border-emerald-100">
                <span className="text-[11px] text-emerald-700 font-medium">Clean Rollouts</span>
                <p className="text-lg font-bold text-emerald-800 mt-0.5">
                  {filteredCommits.filter((c) => c.rolledBack === false).length}
                </p>
              </div>
              <div className="rounded-lg bg-rose-50/50 p-3 border border-rose-100">
                <span className="text-[11px] text-rose-700 font-medium">Rolled Back</span>
                <p className="text-lg font-bold text-rose-800 mt-0.5">
                  {filteredCommits.filter((c) => c.rolledBack === true).length}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50/50 p-3 border border-amber-100">
                <span className="text-[11px] text-amber-700 font-medium">Active Watchdogs</span>
                <p className="text-lg font-bold text-amber-800 mt-0.5">
                  {activeProject?.activeWatchdogs ?? 0}
                </p>
              </div>
            </div>
          </div>

          {/* ── Fault Tolerance Panel ── */}
          <FaultTolerancePanel
            info={deploymentMap[activeProject?.fullName ?? ""] ?? deploymentMap[activeProject?.name ?? ""]}
            installationId={installationId}
            fullName={activeProject?.fullName ?? selectedRepoFilter}
          />

          {showLegend && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">Dynamic Budget</p>
                <p className="text-slate-600 leading-relaxed">
                  The allowable error budget ceiling during rollout. Calibrated from changed AST semantics (infra &gt; dependency &gt; config &gt; code).
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">Observation Window</p>
                <p className="text-slate-600 leading-relaxed">
                  The duration (in seconds) CARF monitors production metrics before declaring a rollout stable.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">Verdicts</p>
                <ul className="text-slate-600 space-y-1">
                  <li><strong className="text-emerald-700">Monitored Clean:</strong> Error rate remained within dynamic budget.</li>
                  <li><strong className="text-rose-700">Rolled Back:</strong> Error spike breached threshold; CARF triggered rollback.</li>
                  <li><strong className="text-amber-700">In Observation:</strong> Watchdog timer active.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Commits Filter & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 mr-1">Filter Commits:</span>
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  statusFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({filteredCommits.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("healthy")}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  statusFilter === "healthy"
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                Clean
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("rolled_back")}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  statusFilter === "rolled_back"
                    ? "bg-rose-700 text-white"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
              >
                Rolled Back
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TableProperties className="size-3.5" />
                <span>Table View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("pipeline")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  viewMode === "pipeline"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="size-3.5" />
                <span>Pipeline View</span>
              </button>
            </div>
          </div>

          {/* Dedicated Project Commits Table / Pipeline */}
          {viewMode === "pipeline" ? (
            <PipelineStageTracker
              commits={filteredCommits}
              emptyMessage={
                activeProject
                  ? `No commits recorded yet for ${activeProject.fullName}.`
                  : "No commits recorded for this project."
              }
            />
          ) : filteredCommits.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
              <p className="text-xs text-slate-500">
                {activeProject
                  ? `No commits recorded yet for ${activeProject.fullName}.`
                  : "No commits recorded for this project."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 text-xs text-slate-700">
                    <TableHead className="font-mono">Commit</TableHead>
                    <TableHead>Change Types</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Rollout Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommits.map((c) => {
                    const outcome = classifyRolloutOutcome(c);

                    return (
                      <TableRow key={c.sha} className="text-xs border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <TableCell className="font-mono text-xs py-3">
                          <div className="flex flex-col gap-0.5">
                            <a
                              href={`https://github.com/${c.owner}/${c.repo}/commit/${c.sha}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline underline-offset-2"
                              title={`Open commit ${c.sha} on GitHub`}
                            >
                              <span>
                                {c.owner}/{c.repo}@{c.sha.slice(0, 7)}
                              </span>
                              <ExternalLink className="size-3 shrink-0 opacity-40" />
                            </a>
                            <span className="text-[11px] text-slate-500">
                              {new Date(c.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.activeTypes.length === 0 ? (
                              <span className="text-[11px] text-slate-400 font-mono">None</span>
                            ) : (
                              c.activeTypes.map((t) => (
                                <Badge key={t} variant="secondary" className="text-[10px] font-mono px-1.5 py-0 capitalize bg-slate-100 text-slate-700">
                                  {t}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          {c.finalThreshold === null || c.finalThreshold === undefined ? (
                            <span className="text-[11px] text-slate-400">--</span>
                          ) : !Number.isFinite(c.finalThreshold) ? (
                            <span className="text-[11px] text-slate-400 font-mono">No signal (∞)</span>
                          ) : (
                            <span
                              title={`Exact calculated limit: ${c.finalThreshold}`}
                              className="font-mono text-xs font-semibold text-slate-900"
                            >
                              {(c.finalThreshold * 100).toFixed(2)}%
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="font-mono text-xs py-3 text-slate-700">
                          {formatWindow(c.finalWindow)}
                        </TableCell>

                        <TableCell className="py-3">
                          {outcome.kind === "healthy" && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium" title={outcome.description}>
                              <CheckCircle2 className="size-3" />
                              <span>{outcome.label}</span>
                            </div>
                          )}

                          {outcome.kind === "rolled_back" && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium" title={outcome.description}>
                              <AlertTriangle className="size-3" />
                              <span>
                                {outcome.label}
                                {outcome.errorRate !== undefined && ` (${(outcome.errorRate * 100).toFixed(1)}% err)`}
                              </span>
                            </div>
                          )}

                          {outcome.kind === "no_signal" && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px]" title={outcome.description}>
                              <Ban className="size-3 opacity-60" />
                              <span>{outcome.label}</span>
                            </div>
                          )}

                          {outcome.kind === "pending" && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px]" title={outcome.description}>
                              <Clock className="size-3" />
                              <span>{outcome.label}</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── Link Project Wizard Modal ── */}
      <LinkProjectModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        installationId={installationId}
        unlinkedRepos={unlinkedRepos}
        onProjectLinked={(repoFullName) => {
          loadDeployment();
          setSelectedRepoFilter(repoFullName);
        }}
      />

      {/* ── Unlink Confirmation Modal ── */}
      <UnlinkConfirmModal
        isOpen={!!unlinkTargetRepo}
        onClose={() => setUnlinkTargetRepo(null)}
        installationId={installationId}
        repo={unlinkTargetRepo}
        onUnlinked={() => {
          loadDeployment();
          if (
            unlinkTargetRepo &&
            (selectedRepoFilter === unlinkTargetRepo.fullName ||
              selectedRepoFilter === unlinkTargetRepo.name)
          ) {
            setSelectedRepoFilter("all");
          }
        }}
      />
    </div>
  );
}

