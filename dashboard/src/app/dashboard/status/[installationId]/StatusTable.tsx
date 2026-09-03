"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Updated {lastUpdated.toLocaleTimeString()} -- auto-refreshes every {POLL_INTERVAL_MS / 1000}s.
          {error && <span className="text-destructive"> {error}</span>}
        </p>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={isRefreshing}
          title="Refresh status now"
          className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          <RefreshCw className={`size-3 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>{isRefreshing ? "Refreshing…" : "Refresh now"}</span>
        </button>
      </div>

      {commits.length === 0 && (
        <p className="rounded-sm border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No classified commits yet.
        </p>
      )}

      {commits.length > 0 && (
        <div className="rounded-sm border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Commit</TableHead>
                <TableHead>Types</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commits.map((c) => (
                <TableRow key={c.sha}>
                  <TableCell className="font-mono text-xs">
                    <a
                      href={`https://github.com/${c.owner}/${c.repo}/commit/${c.sha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary hover:underline underline-offset-2"
                      title={`Open commit ${c.sha} on GitHub`}
                    >
                      <span>{c.owner}/{c.repo}@{c.sha.slice(0, 7)}</span>
                      <ExternalLink className="size-3 shrink-0 opacity-50" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.activeTypes.length === 0 ? (
                        <span className="text-muted-foreground">--</span>
                      ) : (
                        c.activeTypes.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.finalThreshold === null || c.finalThreshold === undefined ? (
                      "--"
                    ) : !Number.isFinite(c.finalThreshold) ? (
                      <span className="text-xs text-muted-foreground">No signal (∞)</span>
                    ) : (
                      <span
                        title={`Exact decimal: ${c.finalThreshold}`}
                        className="font-mono text-xs font-medium"
                      >
                        {(c.finalThreshold * 100).toFixed(1)}%
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatWindow(c.finalWindow)}
                  </TableCell>
                  <TableCell>
                    {c.rolledBack === null ? (
                      <span className="text-muted-foreground">--</span>
                    ) : c.rolledBack ? (
                      <Badge variant="destructive">rolled back</Badge>
                    ) : (
                      <Badge variant="secondary">healthy</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
