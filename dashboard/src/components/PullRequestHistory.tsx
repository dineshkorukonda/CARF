"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitPullRequest, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import type { PullRequestWithPolicy } from "../lib/pullRequestPolicies";
import { commitPageHref, projectSectionHref } from "../lib/dashboardNav";
import { useDashboardDates } from "../lib/useDashboardDates";

export function PullRequestHistory({ owner, repo, compact = false }: { owner: string; repo: string; compact?: boolean }) {
  const [rows, setRows] = useState<PullRequestWithPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("all");
  const dates = useDashboardDates();
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/repo/pull-requests?${new URLSearchParams({ owner, repo })}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load pull requests");
        if (controller.signal.aborted) return;
        setRows(data.pullRequests); setLimited(data.limited); setError(null);
      }).catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load pull requests"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [owner, repo, refresh]);
  const visible = rows.filter((pr) => {
    const status = pr.mergedAt ? "merged" : pr.draft && pr.state === "open" ? "draft" : pr.state;
    return (state === "all" || state === status) && `${pr.number} ${pr.title} ${pr.headSha} ${pr.author}`.toLowerCase().includes(search.toLowerCase().replace(/^#/, ""));
  });
  const githubRepo = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-semibold">{compact ? "Recent pull requests" : "Pull requests"}{!loading && !error && ` (${rows.length})`}</h2>
          <p className="mt-1 text-xs text-muted-foreground">PR titles, current revisions, and CARF policies for their head SHA.</p>
        </div>
        {compact ? <Link href={projectSectionHref(owner, repo, "pull_requests")} className="text-xs text-primary hover:underline">All pull requests</Link> : <Button variant="outline" size="sm" disabled={loading} onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}><RefreshCw className="size-3.5" />{loading ? "Loading…" : "Refresh pull requests"}</Button>}
      </div>
      {!compact && <div className="flex flex-wrap gap-3">
        <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PR number, title, author, or SHA" aria-label="Search pull requests" className="min-w-48 flex-1" />
        <Select value={state} onValueChange={(value) => { if (value) setState(value); }}><SelectTrigger aria-label="Pull request state"><SelectValue>{state === "all" ? "All states" : state[0]!.toUpperCase() + state.slice(1)}</SelectValue></SelectTrigger><SelectContent>{["all", "open", "draft", "merged", "closed"].map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All states" : value[0]!.toUpperCase() + value.slice(1)}</SelectItem>)}</SelectContent></Select>
      </div>}
      {loading && <p role="status" className="text-xs text-muted-foreground">Loading pull requests…</p>}
      {error && <div role="alert" className="text-xs text-destructive">{error} <Button variant="outline" size="sm" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}>Try again</Button></div>}
      {!loading && !error && visible.length === 0 && <p className="text-sm text-muted-foreground">{rows.length ? "No pull requests match these filters." : "No pull requests found. Open a PR on GitHub to see it here."}</p>}
      {!error && <div className="divide-y divide-border">{(compact ? visible.slice(0, 5) : visible).map((pr) => (
        <article key={pr.number} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
          <GitPullRequest className="mt-1 hidden size-4 shrink-0 text-muted-foreground sm:block" />
          <div className="min-w-0 flex-1 space-y-2">
            <a href={`${githubRepo}/pull/${pr.number}`} target="_blank" rel="noreferrer" className="block break-words text-sm font-semibold hover:text-primary">#{pr.number} {pr.title}</a>
            <p className="break-words text-xs text-muted-foreground">{pr.author} · {pr.headRef} → {pr.baseRef} · Updated {dates.dateTime(pr.updatedAt)}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{pr.mergedAt ? "Merged" : pr.state === "closed" ? "Closed" : pr.draft ? "Draft" : "Open"}</Badge>
              <span className="font-mono text-muted-foreground">Head {pr.headSha.slice(0, 7)}</span>
              {pr.policy ? <Link href={commitPageHref(owner, repo, pr.headSha)} className="text-primary hover:underline">View head analysis</Link> : <span className="text-muted-foreground">No policy for current head</span>}
            </div>
          </div>
          {pr.policy && <div className="shrink-0 text-xs sm:text-right"><p className="font-mono">{(pr.policy.finalThreshold * 100).toFixed(2)}% ceiling · {pr.policy.finalWindow}s</p><p className="mt-1 text-muted-foreground">{pr.policy.activeTypes.join(", ")}</p></div>}
        </article>
      ))}</div>}
      {!compact && <p className="text-xs text-muted-foreground">Refresh retrieves PRs and their saved policies. A missing policy may mean the latest PR update has not been analyzed or the changes have no classification signal.</p>}
      {limited && <a href={`${githubRepo}/pulls`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Showing the 50 most recently updated PRs. View older PRs on GitHub.</a>}
    </section>
  );
}
