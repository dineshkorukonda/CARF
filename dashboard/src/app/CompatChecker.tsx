"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import type { CompatibilityReport } from "../lib/compatCheck";

type CheckResult =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "private"; owner: string; repo: string; summary: string }
  | ({ state: "report"; owner: string; repo: string; truncated: boolean } & CompatibilityReport);

const MODE_LABEL: Record<CompatibilityReport["recommendedMode"], string> = {
  standalone: "Standalone mode",
  augment: "Augment mode",
  either: "Either mode works",
  unclear: "Needs one more piece",
};

export function CompatChecker() {
  const [repoUrl, setRepoUrl] = useState("");
  const [result, setResult] = useState<CheckResult>({ state: "idle" });

  async function runCheck() {
    if (!repoUrl.trim()) {
      setResult({ state: "error", message: "Enter a GitHub repo URL or owner/repo first." });
      return;
    }

    setResult({ state: "loading" });

    try {
      const response = await fetch("/api/compat-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const body = await response.json();

      if (!response.ok) {
        setResult({ state: "error", message: body.error ?? "Something went wrong." });
        return;
      }

      if (body.private) {
        setResult({ state: "private", owner: body.owner, repo: body.repo, summary: body.summary });
        return;
      }

      setResult({
        state: "report",
        owner: body.owner,
        repo: body.repo,
        truncated: body.truncated,
        signals: body.signals,
        recommendedMode: body.recommendedMode,
        recommendedAdapter: body.recommendedAdapter,
        summary: body.summary,
      });
    } catch {
      setResult({ state: "error", message: "Couldn't reach the check endpoint — try again." });
    }
  }

  return (
    <div className="rounded-sm border border-border bg-card p-5">
      <p className="text-sm font-medium">Will CARF integrate with your project?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Paste a public GitHub repo and we&apos;ll scan it for a deployment target CARF already knows how to drive.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runCheck();
          }}
          placeholder="github.com/owner/repo"
          className="flex-1 font-mono text-xs"
        />
        <Button onClick={runCheck} disabled={result.state === "loading"} className="shrink-0">
          {result.state === "loading" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Checking…
            </>
          ) : (
            "Check compatibility"
          )}
        </Button>
      </div>

      {result.state === "error" && (
        <p className="mt-3 rounded-sm bg-destructive/10 px-3 py-2 text-xs text-destructive">{result.message}</p>
      )}

      {result.state === "private" && (
        <p className="mt-3 rounded-sm bg-muted px-3 py-2 text-xs text-muted-foreground">{result.summary}</p>
      )}

      {result.state === "report" && (
        <div className="mt-4">
          <div className="rounded-sm border border-border bg-background px-3.5 py-3">
            <p className="text-xs font-semibold text-foreground">
              {result.owner}/{result.repo} — {MODE_LABEL[result.recommendedMode]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{result.summary}</p>
            {result.truncated && (
              <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                This repo is large — the scan may have missed some files.
              </p>
            )}
          </div>

          <div className="mt-2 divide-y divide-border rounded-sm border border-border">
            {result.signals.map((signal) => (
              <div key={signal.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
                {signal.matched ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <X className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40" />
                )}
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${signal.matched ? "text-foreground" : "text-muted-foreground"}`}>
                    {signal.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{signal.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
