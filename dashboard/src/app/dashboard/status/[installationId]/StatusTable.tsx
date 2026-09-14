"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  RefreshCw,
  Filter,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  Layers,
  TableProperties,
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
}: {
  installationId: string;
  initial: RecentCommit[];
}) {
  const [commits, setCommits] = useState<RecentCommit[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedRepoFilter, setSelectedRepoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "observing" | "healthy" | "rolled_back">("all");
  const [viewMode, setViewMode] = useState<"pipeline" | "table">("pipeline");
  const [showLegend, setShowLegend] = useState(false);

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

  const distinctRepos = useMemo(() => {
    const repos = new Set<string>();
    commits.forEach((c) => {
      if (c.owner && c.repo) repos.add(`${c.owner}/${c.repo}`);
    });
    return Array.from(repos);
  }, [commits]);

  const filteredCommits = useMemo(() => {
    return commits.filter((c) => {
      if (selectedRepoFilter !== "all" && `${c.owner}/${c.repo}` !== selectedRepoFilter) {
        return false;
      }
      if (statusFilter !== "all") {
        const outcome = classifyRolloutOutcome(c);
        const isObserving =
          outcome.kind === "pending" &&
          c.finalWindow &&
          new Date(c.createdAt).getTime() + c.finalWindow * 1000 > Date.now();

        if (statusFilter === "observing" && !isObserving) return false;
        if (statusFilter === "healthy" && outcome.kind !== "healthy") return false;
        if (statusFilter === "rolled_back" && outcome.kind !== "rolled_back") return false;
      }
      return true;
    });
  }, [commits, selectedRepoFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Control Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
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

          {/* Repo Filter */}
          {distinctRepos.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="size-3.5 text-slate-400" />
              <select
                value={selectedRepoFilter}
                onChange={(e) => setSelectedRepoFilter(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="all">All Repositories ({distinctRepos.length})</option>
                {distinctRepos.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              All ({commits.length})
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
        <PipelineStageTracker commits={filteredCommits} />
      ) : filteredCommits.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
          <p className="text-xs text-slate-500">
            No commits recorded for the selected filter.
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
  );
}
