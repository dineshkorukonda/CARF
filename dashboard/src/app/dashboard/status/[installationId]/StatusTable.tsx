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
  const [viewMode, setViewMode] = useState<"pipeline" | "table">("pipeline");
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
      {/* ── Section 1: Projects List / Directory ── */}
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
              Click any project to inspect its commit rollout pipeline and watchdog telemetry.
            </p>
          </div>

          {projects.length > 3 && (
            <div className="relative w-full sm:w-60">
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
        </div>

        {/* Project Cards Grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {/* "All Projects" Card */}
          <button
            type="button"
            onClick={() => setSelectedRepoFilter("all")}
            className={`flex flex-col justify-between text-left rounded-lg p-3.5 transition-all border ${
              selectedRepoFilter === "all"
                ? "border-slate-900 bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/10"
                : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300 text-slate-900"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs truncate">All Projects</span>
                {selectedRepoFilter === "all" && <Check className="size-3.5 text-emerald-400" />}
              </div>
              <p
                className={`mt-1 text-[11px] truncate ${
                  selectedRepoFilter === "all" ? "text-slate-300" : "text-slate-500"
                }`}
              >
                Global stream across {projects.length} repos
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-mono">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  selectedRepoFilter === "all"
                    ? "bg-slate-800 text-slate-200"
                    : "bg-slate-200/80 text-slate-700"
                }`}
              >
                {commits.length} commits
              </span>
            </div>
          </button>

          {/* Individual Project Cards */}
          {filteredProjects.map((p) => {
            const isSelected =
              selectedRepoFilter.toLowerCase() === p.fullName.toLowerCase() ||
              selectedRepoFilter.toLowerCase() === p.name.toLowerCase();

            return (
              <button
                key={p.fullName}
                type="button"
                onClick={() => setSelectedRepoFilter(p.fullName)}
                className={`flex flex-col justify-between text-left rounded-lg p-3.5 transition-all border ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/10"
                    : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-900"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-semibold text-xs truncate" title={p.fullName}>
                      {p.name}
                    </span>
                    {isSelected ? (
                      <Check className="size-3.5 text-emerald-400 shrink-0" />
                    ) : p.activeWatchdogs > 0 ? (
                      <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    ) : null}
                  </div>
                  <p
                    className={`mt-0.5 text-[11px] truncate font-mono ${
                      isSelected ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {p.fullName}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100/20">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {p.activeWatchdogs > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                          isSelected
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        <Clock className="size-2.5 animate-spin" />
                        <span>Watchdog ({p.activeWatchdogs})</span>
                      </span>
                    ) : p.rolledBackCount > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                          isSelected
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        <AlertTriangle className="size-2.5" />
                        <span>{p.rolledBackCount} rollback</span>
                      </span>
                    ) : p.totalCommits > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        <CheckCircle2 className="size-2.5" />
                        <span>Clean</span>
                      </span>
                    ) : (
                      <span
                        className={`rounded-full px-1.5 py-0.5 ${
                          isSelected ? "text-slate-400 bg-slate-800" : "text-slate-400 bg-slate-100"
                        }`}
                      >
                        No rollouts
                      </span>
                    )}
                  </div>

                  <span
                    className={`font-mono text-[10px] ${
                      isSelected ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {p.totalCommits} {p.totalCommits === 1 ? "commit" : "commits"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: Commits Rollout Pipeline for Selected Project ── */}
      <div className="flex flex-col gap-4">
        {/* Control & Filter Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Project Indicator */}
            <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
              <span className="text-xs font-semibold text-slate-900">
                {activeProject ? (
                  <span className="flex items-center gap-1.5">
                    <FolderGit2 className="size-3.5 text-slate-500" />
                    <span>{activeProject.fullName}</span>
                  </span>
                ) : (
                  <span>All Repositories</span>
                )}
              </span>
              {selectedRepoFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedRepoFilter("all")}
                  className="text-[10px] font-medium text-slate-500 hover:text-slate-900 underline underline-offset-2 ml-1"
                >
                  Clear filter
                </button>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs">
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
                <span>Compact Table</span>
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

        {/* ── View Content ── */}
        {viewMode === "pipeline" ? (
          <PipelineStageTracker
            commits={filteredCommits}
            emptyMessage={
              activeProject
                ? `No commits recorded yet for ${activeProject.fullName}.`
                : "No commits recorded for the selected filter."
            }
          />
        ) : filteredCommits.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
            <p className="text-xs text-slate-500">
              {activeProject
                ? `No commits recorded yet for ${activeProject.fullName}.`
                : "No commits recorded for the selected filter."}
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
    </div>
  );
}

