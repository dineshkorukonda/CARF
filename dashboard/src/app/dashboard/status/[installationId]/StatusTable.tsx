"use client";

import { useEffect, useState } from "react";
import { Badge } from "../../../../components/ui/badge";
import type { RecentCommit } from "../../../../adapters/coreApi/client";

const POLL_INTERVAL_MS = 15_000;

export function StatusTable({ installationId, initial }: { installationId: string; initial: RecentCommit[] }) {
  const [commits, setCommits] = useState<RecentCommit[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
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
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [installationId]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Updated {lastUpdated.toLocaleTimeString()} -- refreshes every {POLL_INTERVAL_MS / 1000}s.
        {error && <span className="text-destructive"> {error}</span>}
      </p>

      {commits.length === 0 && <p className="text-sm text-muted-foreground">No classified commits yet.</p>}

      {commits.length > 0 && (
        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Commit</th>
                <th className="px-3 py-2 font-medium">Types</th>
                <th className="px-3 py-2 font-medium">Threshold</th>
                <th className="px-3 py-2 font-medium">Window</th>
                <th className="px-3 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {commits.map((c) => (
                <tr key={c.sha} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">
                    {c.owner}/{c.repo}@{c.sha.slice(0, 7)}
                  </td>
                  <td className="px-3 py-2">
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
                  </td>
                  <td className="px-3 py-2">{c.finalThreshold ?? "--"}</td>
                  <td className="px-3 py-2">{c.finalWindow ? `${c.finalWindow}s` : "--"}</td>
                  <td className="px-3 py-2">
                    {c.rolledBack === null ? (
                      <span className="text-muted-foreground">--</span>
                    ) : c.rolledBack ? (
                      <Badge variant="destructive">rolled back</Badge>
                    ) : (
                      <Badge variant="secondary">healthy</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
