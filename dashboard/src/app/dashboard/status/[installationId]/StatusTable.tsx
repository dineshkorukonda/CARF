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
  GitCommit,
  Check,
  Search,
  ArrowLeft,
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

const POLL_INTERVAL_MS = 15_000;

function formatWindow(seconds: number | null): string {
  if (!seconds) return "--";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${seconds}s (${minutes}m)`;
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

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q) || p.fullName.toLowerCase().includes(q));
  }, [projects, searchQuery]);

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
                    Projects & Repositories ({projects.length})
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select any repository to view its dedicated rollout commits, risk scores, and watchdog telemetry.
                </p>
              </div>

              {projects.length > 2 && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/70 pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              )}
            </div>

            {filteredProjects.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No repositories found matching &ldquo;{searchQuery}&rdquo;.
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

                        <TableCell className="py-3 text-right">
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
    </div>
  );
}

