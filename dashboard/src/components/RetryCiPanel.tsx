"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { CiSnapshot } from "../lib/ciStatus";
import type { CiRetryResult } from "../lib/retryCi";

export function RetryCiPanel({ installationId, owner, repo, commits, ci, onRequested }: {
  installationId: string; owner: string; repo: string; commits: { sha: string }[];
  ci?: CiSnapshot; onRequested(): void;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(5);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<CiRetryResult[]>([]);
  const recent = commits.slice(0, count);
  const eligible = (limit: number) => commits.slice(0, limit).flatMap((commit) => {
    const run = ci?.runs[commit.sha];
    return run?.status === "completed" && run.conclusion !== "success" ? [run.id] : [];
  });
  const available = !!ci && !ci.unavailable;

  async function submit() {
    setBusy(true); setError(""); setResults([]);
    try {
      const response = await fetch("/api/repo/retry-ci", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId, owner, repo, runIds: selected }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Retry request failed");
      setResults(body.results);
      setSelected([]);
      onRequested();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Retry request failed. Check Actions before retrying.");
    } finally { setBusy(false); }
  }

  return <div className="mt-3 rounded-lg border border-border">
    <button type="button" aria-expanded={open} onClick={() => { if (!open) setSelected(eligible(count)); setOpen(!open); }} className="flex w-full items-center gap-2 p-3 text-left text-xs font-semibold hover:bg-muted/30">
      <RefreshCw className="size-3.5" />Retry recent CI<span className="ml-auto text-muted-foreground">{open ? "−" : "+"}</span>
    </button>
    {open && <div className="space-y-3 border-t border-border p-3">
      <p className="text-xs text-muted-foreground">Rerun checks for selected commits. Only the current branch tip can deploy; older revisions remain superseded.</p>
      <p className="text-xs text-muted-foreground">Retries use each commit’s original code and workflow. Later fixes do not repair an older run, and its GitHub concurrency rules still apply.</p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label>Recent commits <select disabled={busy} value={count} onChange={(event) => { const limit = Number(event.target.value); setCount(limit); setSelected(eligible(limit)); setResults([]); }} className="ml-2 rounded border border-border bg-background px-2 py-1"><option value={3}>Last 3</option><option value={5}>Last 5</option><option value={10}>Last 10</option></select></label>
        <button type="button" disabled={busy || !available} onClick={() => setSelected(eligible(count))} className="text-primary underline disabled:opacity-50">Select failed / cancelled / skipped</button>
      </div>
      {!available && <p role="status" className="text-xs text-amber-600">Waiting for GitHub CI status before enabling retries.</p>}
      <div className="divide-y divide-border">
        {recent.map(({ sha }) => {
          const run = ci?.runs[sha];
          const disabled = busy || !available || !run || run.status !== "completed";
          return <div key={sha} className="flex flex-wrap items-center gap-3 py-2 text-xs">
            <label className="flex flex-1 items-center gap-2"><input type="checkbox" disabled={disabled} checked={!!run && selected.includes(run.id)} onChange={(event) => { if (run) setSelected((previous) => event.target.checked ? [...previous, run.id] : previous.filter((id) => id !== run.id)); }} /><span className="font-mono">{sha.slice(0, 7)}</span>{sha === ci?.headSha && <span className="text-primary">Current tip</span>}</label>
            <span className="text-muted-foreground">{!run ? "No CI run found" : run.status === "completed" ? `CI ${run.conclusion ?? "completed"}` : `CI ${run.status.replaceAll("_", " ")}`}</span>
            {run && <a href={run.url} target="_blank" rel="noreferrer" className="text-primary underline">View run</a>}
          </div>;
        })}
      </div>
      <button type="button" disabled={busy || !available || !selected.length} onClick={submit} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Requesting retries…" : `Retry selected CI (${selected.length})`}</button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {!!results.length && <ul aria-live="polite" className="space-y-2 text-xs">{results.map((result) => <li key={result.runId} className={result.status === "error" ? "text-red-600" : "text-muted-foreground"}><a className="mr-2 font-mono text-primary underline" href={result.url} target="_blank" rel="noreferrer">{result.sha?.slice(0, 7) || `Run ${result.runId}`}</a>{result.message}</li>)}</ul>}
    </div>}
  </div>;
}
