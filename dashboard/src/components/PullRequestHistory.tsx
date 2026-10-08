"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import type { PullRequestWithPolicy } from "../lib/pullRequestPolicies";
import { pullRequestPageHref, projectSectionHref } from "../lib/dashboardNav";
import { useDashboardDates } from "../lib/useDashboardDates";

export function PullRequestHistory({ owner, repo, compact = false }: { owner: string; repo: string; compact?: boolean }) {
  const [rows, setRows] = useState<PullRequestWithPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("all");
  const [changeType, setChangeType] = useState("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
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
    return (state === "all" || state === status) && (changeType === "all" || pr.policy?.activeTypes.includes(changeType)) && `${pr.number} ${pr.title} ${pr.headSha} ${pr.author}`.toLowerCase().includes(search.toLowerCase().replace(/^#/, ""));
  });
  const githubRepo = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-semibold">{compact ? "Recent pull requests" : "Pull requests & Change-Aware Risk Classification"}{!loading && !error && ` (${visible.length})`}</h2>
          <p className="mt-1 text-xs text-muted-foreground">History of analyzed pull requests, calibrated thresholds, and current PR revisions.</p>
        </div>
        {compact ? <Link href={projectSectionHref(owner, repo, "pull_requests")} className="text-xs text-primary hover:underline">All pull requests</Link> : <Button variant="outline" size="sm" disabled={loading} onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}><RefreshCw className="size-3.5" />{loading ? "Loading…" : "Refresh pull requests"}</Button>}
      </div>
      {!compact && <div role="group" aria-label="Pull request state" className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/20 p-1">{["all", "open", "draft", "merged", "closed"].map((value) => <Button key={value} variant={state === value ? "secondary" : "ghost"} size="sm" aria-pressed={state === value} onClick={() => setState(value)}>{value[0]!.toUpperCase() + value.slice(1)}</Button>)}</div>}
      {!compact && <div className="flex flex-wrap gap-3">
        <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PR number, title, author, or SHA" aria-label="Search pull requests" className="min-w-48 flex-1" />
        <Select value={changeType} onValueChange={(value) => { if (value) setChangeType(value); }}><SelectTrigger aria-label="Change type"><SelectValue>{changeType === "all" ? "All change types" : changeType}</SelectValue></SelectTrigger><SelectContent>{["all", "code", "config", "dependency", "infra", "data"].map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All change types" : value}</SelectItem>)}</SelectContent></Select>
      </div>}
      {loading && <p role="status" className="text-xs text-muted-foreground">Loading pull requests…</p>}
      {error && <div role="alert" className="text-xs text-destructive">{error} <Button variant="outline" size="sm" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}>Try again</Button></div>}
      {!loading && !error && visible.length === 0 && <p className="text-sm text-muted-foreground">{rows.length ? "No pull requests match these filters." : "No pull requests found. Open a PR on GitHub to see it here."}</p>}
      {!error && visible.length > 0 && <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">{(compact ? visible.slice(0, 5) : visible).map((pr) => (
        <article key={pr.number}>
          <div className="flex flex-col justify-between gap-3 p-3 text-xs sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-2">
              <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={"Risk details for PR #" + pr.number} aria-expanded={expanded.has(pr.number)} aria-controls={"pr-risk-" + pr.number} onClick={() => setExpanded((previous) => { const next = new Set(previous); if (next.has(pr.number)) next.delete(pr.number); else next.add(pr.number); return next; })}>{expanded.has(pr.number) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</Button>
              <div className="min-w-0">
                <Link href={pullRequestPageHref(owner, repo, pr.number)} className="break-words text-sm font-semibold hover:text-primary"><span className="font-mono">#{pr.number}</span> {pr.title}</Link>
                <p className="mt-1 break-words text-muted-foreground">{pr.author} · {pr.headRef} → {pr.baseRef} · {dates.dateTime(pr.updatedAt)}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 pl-10 sm:pl-0">
              <Badge variant="outline">{pr.mergedAt ? "Merged" : pr.state === "closed" ? "Closed" : pr.draft ? "Draft" : "Open"}</Badge>
              <a href={githubRepo + "/pull/" + pr.number} target="_blank" rel="noreferrer" className="text-primary hover:underline">View PR</a>
              {pr.policy ? <span className="rounded bg-muted px-2 py-1 font-mono text-muted-foreground">Policy: {(pr.policy.finalThreshold * 100).toFixed(2)}% / {pr.policy.finalWindow}s</span> : <span className="text-muted-foreground">No policy for current head</span>}
            </div>
          </div>
          {expanded.has(pr.number) && <div id={"pr-risk-" + pr.number} className="border-t border-border bg-muted/20 p-4">
            <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Calibrated Threshold</dt><dd className="mt-1 font-mono font-semibold">{pr.policy ? (pr.policy.finalThreshold * 100).toFixed(2) + "%" : "N/A"}</dd></div>
              <div><dt className="text-muted-foreground">Observation Window</dt><dd className="mt-1 font-mono font-semibold">{pr.policy ? pr.policy.finalWindow + "s" : "N/A"}</dd></div>
              <div><dt className="text-muted-foreground">Risk Factors</dt><dd className="mt-1 break-words capitalize">{pr.policy?.activeTypes.join(", ") || "No classified signal"}</dd></div>
              <div><dt className="text-muted-foreground">Classification</dt><dd className="mt-1">{pr.vector ? ["code", "config", "dependency", "infra", "data"].map((key) => key + " " + (pr.vector![key as keyof typeof pr.vector] * 100).toFixed(0) + "%").join(" · ") : "No vector stored"}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs"><span className="font-mono text-muted-foreground">Head {pr.headSha.slice(0, 7)}</span><Link href={pullRequestPageHref(owner, repo, pr.number)} className="text-primary hover:underline">View PR analysis</Link></div>
          </div>}
        </article>
      ))}</div>}
      {!compact && <p className="text-xs text-muted-foreground">Refresh retrieves PRs and their saved policies. A missing policy may mean the latest PR update has not been analyzed or the changes have no classification signal.</p>}
      {limited && <a href={`${githubRepo}/pulls`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Showing the 50 most recently updated PRs. View older PRs on GitHub.</a>}
    </section>
  );
}
