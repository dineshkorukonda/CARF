"use client";

import { useEffect, useState } from "react";
import {
  GitCommit,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  Layers,
} from "lucide-react";
import type { RecentCommit } from "../../adapters/coreApi/client";
import { classifyRolloutOutcome } from "../../lib/outcomeClassifier";
import { Badge } from "../../components/ui/badge";

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  } catch {
    return dateString;
  }
}

function CommitCard({ commit }: { commit: RecentCommit }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  const outcome = classifyRolloutOutcome(commit);
  const createdAtMs = new Date(commit.createdAt).getTime();
  const windowSeconds = commit.finalWindow ?? 180;
  const expiresAtMs = createdAtMs + windowSeconds * 1000;
  const isWithinWindow = now < expiresAtMs;
  const isInObservation = outcome.kind === "pending" && isWithinWindow;
  const remainingSeconds = Math.max(0, Math.ceil((expiresAtMs - now) / 1000));
  const progressPct = Math.min(100, Math.max(0, ((now - createdAtMs) / (windowSeconds * 1000)) * 100));

  useEffect(() => {
    if (!isInObservation) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isInObservation]);

  function copySha() {
    navigator.clipboard.writeText(commit.sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const thresholdPct =
    commit.finalThreshold !== null && Number.isFinite(commit.finalThreshold)
      ? `${(commit.finalThreshold * 100).toFixed(2)}%`
      : "Default (5.0%)";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300">
      {/* ── Top Header Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
            <GitCommit className="size-4 text-slate-500" />
            {commit.owner}/{commit.repo}
          </span>
          <div className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
            <span>{commit.sha.slice(0, 7)}</span>
            <button
              onClick={copySha}
              className="ml-1 text-slate-400 hover:text-slate-700"
              title="Copy commit SHA"
            >
              {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{formatRelativeTime(commit.createdAt)}</span>
          <a
            href={`https://github.com/${commit.owner}/${commit.repo}/commit/${commit.sha}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors"
          >
            <span>GitHub</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      {/* ── Horizontal 5-Stage Pipeline ── */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Stage 1: Ingestion */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                1. Webhook
              </span>
              <CheckCircle2 className="size-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Ingested & Verified</p>
              <p className="text-[11px] text-slate-500">HMAC-SHA256 valid</p>
            </div>
          </div>

          {/* Stage 2: AST Classification */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                2. Classification
              </span>
              <Layers className="size-3.5 text-indigo-600" />
            </div>
            <div>
              <div className="flex flex-wrap gap-1 mb-1">
                {commit.activeTypes.length > 0 ? (
                  commit.activeTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className="bg-white text-[10px] px-1.5 py-0 capitalize text-slate-700 border-slate-200"
                    >
                      {type}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">Pure Code / Doc</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Tier-1 & Tier-2 AST</p>
            </div>
          </div>

          {/* Stage 3: Dynamic Threshold */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                3. Error Budget
              </span>
              <Zap className="size-3.5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">{thresholdPct}</p>
              <p className="text-[11px] text-slate-500">
                Window: {commit.finalWindow ? `${commit.finalWindow}s` : "180s"}
              </p>
            </div>
          </div>

          {/* Stage 4: Watchdog Timer */}
          <div
            className={`rounded-lg border p-3 flex flex-col justify-between gap-2 ${
              isInObservation
                ? "border-amber-200 bg-amber-50/60"
                : "border-slate-100 bg-slate-50/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                4. Watchdog
              </span>
              <Clock
                className={`size-3.5 ${
                  isInObservation ? "animate-spin text-amber-600" : "text-slate-500"
                }`}
              />
            </div>
            <div>
              {isInObservation ? (
                <>
                  <p className="text-xs font-semibold text-amber-900">
                    ⏱️ {remainingSeconds}s left
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/70">
                    <div
                      className="h-full bg-amber-600 transition-all duration-1000"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-800">
                    Observed {commit.finalWindow ?? 180}s
                  </p>
                  <p className="text-[11px] text-slate-500">Watchdog elapsed</p>
                </>
              )}
            </div>
          </div>

          {/* Stage 5: Final Verdict */}
          <div
            className={`rounded-lg border p-3 flex flex-col justify-between gap-2 ${
              outcome.kind === "rolled_back"
                ? "border-rose-200 bg-rose-50/70"
                : outcome.kind === "healthy"
                ? "border-emerald-200 bg-emerald-50/70"
                : "border-slate-100 bg-slate-50/70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                5. Verdict
              </span>
              {outcome.kind === "rolled_back" ? (
                <AlertTriangle className="size-3.5 text-rose-600" />
              ) : outcome.kind === "healthy" ? (
                <ShieldCheck className="size-3.5 text-emerald-600" />
              ) : (
                <Clock className="size-3.5 text-amber-600" />
              )}
            </div>
            <div>
              {outcome.kind === "rolled_back" ? (
                <>
                  <p className="text-xs font-semibold text-rose-900">Rolled Back</p>
                  <p className="text-[11px] text-rose-700">
                    Error rate: {commit.finalErrorRate ? `${(commit.finalErrorRate * 100).toFixed(2)}%` : "Breached"}
                  </p>
                </>
              ) : outcome.kind === "healthy" ? (
                <>
                  <p className="text-xs font-semibold text-emerald-900">Monitored Clean</p>
                  <p className="text-[11px] text-emerald-700">0 rollbacks needed</p>
                </>
              ) : isInObservation ? (
                <>
                  <p className="text-xs font-semibold text-amber-900">Observing Telemetry</p>
                  <p className="text-[11px] text-amber-700">Evaluating errors</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-700">{outcome.label}</p>
                  <p className="text-[11px] text-slate-500">Observation settled</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Accordion Toggle ── */}
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors"
          >
            <span>{expanded ? "Hide Details" : "View Breakdown & Math"}</span>
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>

        {/* ── Accordion Content ── */}
        {expanded && (
          <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <h4 className="font-semibold text-slate-800 mb-1">Dynamic Calculation Breakdown</h4>
              <p className="text-slate-600 mb-2 leading-relaxed">
                CARF adjusts the rollback sensitivity ceiling based on the commit&apos;s change vector:
              </p>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Base Budget:</span>
                  <span className="text-slate-900 font-semibold">5.0%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Active Change Types:</span>
                  <span className="text-slate-900">{commit.activeTypes.join(", ") || "None"}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="text-slate-700 font-medium">Final Dynamic Ceiling:</span>
                  <span className="text-emerald-700 font-bold">{thresholdPct}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <h4 className="font-semibold text-slate-800 mb-1">Rollout Safety Summary</h4>
              <p className="text-slate-600 leading-relaxed mb-2">
                {outcome.description}
              </p>
              <div className="font-mono text-[11px] text-slate-500 space-y-0.5">
                <div>Commit SHA: {commit.sha}</div>
                <div>Recorded: {new Date(commit.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PipelineStageTracker({
  commits,
  emptyMessage = "No rollouts recorded yet.",
}: {
  commits: RecentCommit[];
  emptyMessage?: string;
}) {
  if (commits.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 mb-4">
          <GitCommit className="size-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">No Rollouts Recorded Yet</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 leading-relaxed">
          CARF is listening for GitHub push events across your connected repositories. Push code or merge a pull request to watch its AST classification and watchdog observation run live.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {commits.map((commit) => (
        <CommitCard key={`${commit.owner}/${commit.repo}/${commit.sha}`} commit={commit} />
      ))}
    </div>
  );
}
