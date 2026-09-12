"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Filter, HelpCircle, AlertTriangle, CheckCircle2, Clock, Ban } from "lucide-react";
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

const POLL_INTERVAL_MS = 15_000;

function formatWindow(seconds: number | null): string {
  if (!seconds) return "--";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${seconds}s (${minutes}m)`;
}

export function StatusTable({ installationId, initial }: { installationId: string; initial: RecentCommit[] }) {
  const [commits, setCommits] = useState<RecentCommit[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedRepoFilter, setSelectedRepoFilter] = useState<string>("all");
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
    if (selectedRepoFilter === "all") return commits;
    return commits.filter((c) => `${c.owner}/${c.repo}` === selectedRepoFilter);
  }, [commits, selectedRepoFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-sm border border-border">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground font-mono">
            Updated {lastUpdated.toLocaleTimeString()} · poll {POLL_INTERVAL_MS / 1000}s
            {error && <span className="text-destructive"> ({error})</span>}
          </p>

          {distinctRepos.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="size-3.5 text-muted-foreground" />
              <select
                value={selectedRepoFilter}
                onChange={(e) => setSelectedRepoFilter(e.target.value)}
                className="rounded-sm border border-border bg-background px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <HelpCircle className="size-3" />
            <span>{showLegend ? "Hide Guide" : "Metrics Guide"}</span>
          </button>

          <button
            type="button"
            onClick={fetchStatus}
            disabled={isRefreshing}
            title="Refresh status now"
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`size-3 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Polling…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {showLegend && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-sm border border-border bg-muted/30 p-4 text-xs">
          <div className="space-y-1">
            <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">Threshold</p>
            <p className="text-muted-foreground leading-relaxed">
              The dynamic max error budget allowable during deployment. Calculated from changed AST semantics and risk weights (infra &gt; dependency &gt; config &gt; code).
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">Observation Window</p>
            <p className="text-muted-foreground leading-relaxed">
              The duration (in seconds) CARF monitors production health before marking a rollout stable.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">Rollout Verdicts</p>
            <ul className="text-muted-foreground space-y-1">
              <li><strong className="text-foreground">Healthy:</strong> Error rate remained within budget.</li>
              <li><strong className="text-foreground">Rolled Back:</strong> Error spike breached threshold.</li>
              <li><strong className="text-foreground">No Signal:</strong> Commit modified documentation or non-impact files.</li>
              <li><strong className="text-foreground">Pending / Augment:</strong> Active observation or external pipeline target.</li>
            </ul>
          </div>
        </div>
      )}

      {commits.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border px-4 py-12 text-center bg-card">
          <p className="text-sm font-medium text-foreground">No classified commits yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
            Push a commit to any repository under this installation to trigger CARF commit diff classification and threshold calibration.
          </p>
        </div>
      ) : filteredCommits.length === 0 ? (
        <div className="rounded-sm border border-border px-4 py-8 text-center bg-card">
          <p className="text-xs text-muted-foreground">
            No commits recorded for repository <code>{selectedRepoFilter}</code>.
          </p>
        </div>
      ) : (
        <div className="rounded-sm border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
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
                  <TableRow key={c.sha} className="text-xs border-b border-border last:border-0">
                    <TableCell className="font-mono text-xs py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <a
                          href={`https://github.com/${c.owner}/${c.repo}/commit/${c.sha}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary hover:underline underline-offset-2"
                          title={`Open commit ${c.sha} on GitHub`}
                        >
                          <span>
                            {c.owner}/{c.repo}@{c.sha.slice(0, 7)}
                          </span>
                          <ExternalLink className="size-3 shrink-0 opacity-40" />
                        </a>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.activeTypes.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground font-mono">None</span>
                        ) : (
                          c.activeTypes.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px] font-mono px-1.5 py-0 capitalize">
                              {t}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-2.5">
                      {c.finalThreshold === null || c.finalThreshold === undefined ? (
                        <span className="text-[11px] text-muted-foreground">--</span>
                      ) : !Number.isFinite(c.finalThreshold) ? (
                        <span className="text-[11px] text-muted-foreground font-mono">No signal (∞)</span>
                      ) : (
                        <span
                          title={`Exact calculated limit: ${c.finalThreshold}`}
                          className="font-mono text-xs font-semibold text-foreground"
                        >
                          {(c.finalThreshold * 100).toFixed(2)}%
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="font-mono text-xs py-2.5">
                      {formatWindow(c.finalWindow)}
                    </TableCell>

                    <TableCell className="py-2.5">
                      {outcome.kind === "healthy" && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium" title={outcome.description}>
                          <CheckCircle2 className="size-3" />
                          <span>{outcome.label}</span>
                        </div>
                      )}

                      {outcome.kind === "rolled_back" && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-destructive/10 text-destructive border border-destructive/20 text-[11px] font-medium" title={outcome.description}>
                          <AlertTriangle className="size-3" />
                          <span>
                            {outcome.label}
                            {outcome.errorRate !== undefined && ` (${(outcome.errorRate * 100).toFixed(1)}% err)`}
                          </span>
                        </div>
                      )}

                      {outcome.kind === "no_signal" && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-muted text-muted-foreground border border-border text-[11px]" title={outcome.description}>
                          <Ban className="size-3 opacity-60" />
                          <span>{outcome.label}</span>
                        </div>
                      )}

                      {outcome.kind === "pending" && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px]" title={outcome.description}>
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
