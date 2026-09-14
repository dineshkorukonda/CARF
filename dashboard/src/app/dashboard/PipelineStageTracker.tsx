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
  Terminal,
  Activity,
  OctagonAlert,
  FastForward,
} from "lucide-react";
import type { RecentCommit } from "../../adapters/coreApi/client";
import { classifyRolloutOutcome } from "../../lib/outcomeClassifier";

function formatRelativeTime(dateString: string, currentMs: number): string {
  try {
    if (!currentMs) return "just now";
    const diffMs = currentMs - new Date(dateString).getTime();
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
  const [now, setNow] = useState<number>(0);
  const [isIntervening, setIsIntervening] = useState<string | null>(null);
  const [interventionFeedback, setInterventionFeedback] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const outcome = classifyRolloutOutcome(commit);
  const createdAtMs = new Date(commit.createdAt).getTime();
  const windowSeconds = commit.finalWindow ?? 180;
  const expiresAtMs = createdAtMs + windowSeconds * 1000;
  const effectiveNow = now || createdAtMs;
  const isWithinWindow = effectiveNow < expiresAtMs;
  const isInObservation = outcome.kind === "pending" && isWithinWindow;
  const remainingSeconds = Math.max(0, Math.ceil((expiresAtMs - effectiveNow) / 1000));
  const progressPct = Math.min(100, Math.max(0, ((effectiveNow - createdAtMs) / (windowSeconds * 1000)) * 100));

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

  async function handleIntervention(action: "rollback" | "promote") {
    setIsIntervening(action);
    setInterventionFeedback(null);
    try {
      const res = await fetch("/api/rollout/intervention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitSha: commit.sha, action }),
      });
      if (res.ok) {
        setInterventionFeedback(
          action === "rollback" ? "Rollback triggered successfully" : "Rollout fast-tracked & promoted"
        );
      } else {
        setInterventionFeedback("Intervention failed to dispatch");
      }
    } catch {
      setInterventionFeedback("Network error dispatching intervention");
    } finally {
      setIsIntervening(null);
    }
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
          <span className="text-xs text-slate-500">{formatRelativeTime(commit.createdAt, effectiveNow)}</span>
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

      {/* ── 5 Horizontal Progressive Delivery Stages ── */}
      <div className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Stage 1: Webhook Ingestion */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                1. Ingestion
              </span>
              <CheckCircle2 className="size-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">Webhook Verified</p>
              <p className="text-[11px] text-slate-500 truncate">SHA: {commit.sha.slice(0, 7)}</p>
            </div>
          </div>

          {/* Stage 2: AST Classification */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                2. AST Parsing
              </span>
              <Layers className="size-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 truncate">
                {commit.activeTypes.length > 0 ? commit.activeTypes.join(", ") : "Unclassified"}
              </p>
              <p className="text-[11px] text-slate-500">
                {commit.activeTypes.length > 0 ? `${commit.activeTypes.length} types detected` : "Safe baseline"}
              </p>
            </div>
          </div>

          {/* Stage 3: Dynamic Threshold */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                3. Dynamic Budget
              </span>
              <Zap className="size-3.5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 font-mono">{thresholdPct}</p>
              <p className="text-[11px] text-slate-500">Window: {commit.finalWindow ?? 180}s</p>
            </div>
          </div>

          {/* Stage 4: Live Observation Watchdog */}
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
              {isInObservation ? (
                <Clock className="size-3.5 text-amber-600 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5 text-emerald-600" />
              )}
            </div>
            <div>
              {isInObservation ? (
                <>
                  <div className="flex justify-between text-xs font-medium text-amber-900 mb-1">
                    <span>Active</span>
                    <span className="font-mono">{remainingSeconds}s left</span>
                  </div>
                  <div className="h-1.5 w-full bg-amber-200/50 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${progressPct}%` }}
                      className="h-full bg-amber-500 transition-all duration-1000"
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-900">Completed</p>
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

        {/* ── Operator Interventions Banner for in-flight rollouts ── */}
        {isInObservation && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/40 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-amber-900">
              <Activity className="size-4 text-amber-600 animate-pulse" />
              <span className="font-semibold">Live Rollout In-Flight:</span>
              <span>Watchdog timer active ({remainingSeconds}s remaining).</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={Boolean(isIntervening)}
                onClick={() => handleIntervention("rollback")}
                className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 shadow-2xs transition-colors disabled:opacity-50"
              >
                <OctagonAlert className="size-3.5 text-rose-600" />
                <span>Abort & Rollback</span>
              </button>
              <button
                disabled={Boolean(isIntervening)}
                onClick={() => handleIntervention("promote")}
                className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 shadow-2xs transition-colors disabled:opacity-50"
              >
                <FastForward className="size-3.5 text-emerald-600" />
                <span>Fast-Track / Promote</span>
              </button>
            </div>
          </div>
        )}

        {interventionFeedback && (
          <div className="mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1">
            {interventionFeedback}
          </div>
        )}

        {/* ── Accordion Toggle ── */}
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors"
          >
            <span>{expanded ? "Hide AST Details" : "View AST Breakdown & Formula Math"}</span>
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>

        {/* ── Expanded AST Risk & Diff Inspector Drawer ── */}
        {expanded && (
          <div className="mt-3 border-t border-slate-100 pt-4 text-xs text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 space-y-2">
              <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Layers className="size-4 text-blue-600" />
                <span>Dynamic Sensitivity Math</span>
              </h4>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Threshold formula evaluated by CARF&apos;s mathematical decision engine:
              </p>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Base Threshold:</span>
                  <span className="text-slate-900 font-semibold">5.0% (code)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Active Change Types:</span>
                  <span className="text-slate-900 font-semibold">
                    {commit.activeTypes.join(", ") || "none (safe baseline)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Observation Duration:</span>
                  <span className="text-slate-900 font-semibold">{commit.finalWindow ?? 180} seconds</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-700 font-medium">Final Calibrated Error Budget:</span>
                  <span className="text-emerald-700 font-bold">{thresholdPct}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 space-y-2">
              <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Terminal className="size-4 text-slate-700" />
                <span>CLI & Webhook Verification</span>
              </h4>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Query this commit&apos;s threshold directly from Argo Rollouts or CI scripts:
              </p>
              <div className="rounded bg-slate-900 p-2 text-emerald-400 font-mono text-[10px] break-all select-all">
                curl -s &quot;https://carf.indevs.in/v1/threshold?commit={commit.sha}&quot;
              </div>
              <p className="text-slate-500 text-[10px] pt-1">
                Recorded: {new Date(commit.createdAt).toLocaleString()} · Scoped to {commit.owner}/{commit.repo}
              </p>
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
        <h3 className="text-base font-semibold text-slate-900">{emptyMessage}</h3>
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
