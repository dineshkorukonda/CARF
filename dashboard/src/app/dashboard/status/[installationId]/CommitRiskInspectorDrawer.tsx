"use client";

import {
  X,
  AlertTriangle,
  Flame,
  Code2,
  ExternalLink,
  Calculator,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import type { RecentCommit } from "../../../../adapters/coreApi/client";

interface CommitRiskInspectorDrawerProps {
  commit: RecentCommit | null;
  onClose: () => void;
}

export function CommitRiskInspectorDrawer({
  commit,
  onClose,
}: CommitRiskInspectorDrawerProps) {
  if (!commit) return null;

  const thresholdPct =
    commit.finalThreshold !== null && commit.finalThreshold !== undefined
      ? Number.isFinite(commit.finalThreshold)
        ? (commit.finalThreshold * 100).toFixed(2) + "%"
        : "∞ (No Signal)"
      : "--";

  const numThreshold = commit.finalThreshold ?? 0.05;
  const isHighRisk = numThreshold < 0.015;
  const isMediumRisk = numThreshold >= 0.015 && numThreshold < 0.035;

  const windowSecs = commit.finalWindow ?? 180;
  const windowMins = Math.round(windowSecs / 60);

  const hasData = commit.activeTypes.includes("data");
  const hasInfra = commit.activeTypes.includes("infra");
  const hasCode = commit.activeTypes.includes("code");
  const hasConfig = commit.activeTypes.includes("config");
  const hasDeps = commit.activeTypes.includes("dependency");

  // Determine plain English assessment
  let verdictTitle = "Low Risk Change";
  let verdictSummary =
    "This commit primarily touches non-critical code or isolated components. CARF has allocated a generous error tolerance budget.";
  let verdictBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";

  if (hasData || hasInfra || isHighRisk) {
    verdictTitle = "High Risk / Critical Blast Radius";
    verdictSummary =
      "This commit modifies database schemas, database migrations, or core infrastructure definitions. CARF has tightened error tolerance to catch regressions instantly.";
    verdictBadge = "bg-rose-50 text-rose-700 border-rose-200";
  } else if (isMediumRisk) {
    verdictTitle = "Moderate Risk Change";
    verdictSummary =
      "This commit updates application logic or configuration. Tree-sitter AST structural analysis has calibrated a standard error tolerance.";
    verdictBadge = "bg-amber-50 text-amber-700 border-amber-200";
  }

  const githubCommitUrl = `https://github.com/${commit.owner}/${commit.repo}/commit/${commit.sha}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Calculator className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Commit AST & Risk Inspector
                </h2>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${verdictBadge}`}>
                  {verdictTitle}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                {commit.owner}/{commit.repo}@{commit.sha.slice(0, 7)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Plain English Verdict Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                Plain-English Risk Verdict
              </span>
              <a
                href={githubCommitUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <span>View Diff on GitHub</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-normal">
              {verdictSummary}
            </p>
          </div>

          {/* Key Metrics Display */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">Dynamic Error Budget</span>
              <div className="mt-1 text-xl font-extrabold text-slate-900">{thresholdPct}</div>
              <span className="text-[10px] text-slate-400">Max allowed failure rate</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">Observation Soak</span>
              <div className="mt-1 text-xl font-extrabold text-slate-900">
                {windowSecs}s <span className="text-xs font-normal text-slate-500">({windowMins}m)</span>
              </div>
              <span className="text-[10px] text-slate-400">Canary evaluation window</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-slate-500">Rollout Status</span>
              <div className="mt-1 text-sm font-bold text-slate-800">
                {commit.rolledBack === true
                  ? "Rolled Back"
                  : commit.rolledBack === false
                  ? "Clean"
                  : "Pending / Augment"}
              </div>
              <span className="text-[10px] text-slate-400">Post-deploy outcome</span>
            </div>
          </div>

          {/* Contributing AST Categories */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <Code2 className="size-4 text-blue-600" />
              <span>Tree-sitter AST & Diff Classification</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div
                className={`rounded-lg p-2.5 border text-xs ${
                  hasCode
                    ? "bg-blue-50/70 border-blue-200 text-blue-900"
                    : "bg-slate-50 border-slate-100 text-slate-400"
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>Logic Code</span>
                  {hasCode && <CheckCircle2 className="size-3 text-blue-600" />}
                </div>
                <div className="text-[11px] mt-0.5">
                  {hasCode ? "Active (Parsed by AST)" : "Not touched"}
                </div>
              </div>

              <div
                className={`rounded-lg p-2.5 border text-xs ${
                  hasData
                    ? "bg-rose-50/70 border-rose-200 text-rose-900"
                    : "bg-slate-50 border-slate-100 text-slate-400"
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>Database / Schema</span>
                  {hasData && <Flame className="size-3 text-rose-600" />}
                </div>
                <div className="text-[11px] mt-0.5">
                  {hasData ? "Active (High Sensitivity)" : "Clean"}
                </div>
              </div>

              <div
                className={`rounded-lg p-2.5 border text-xs ${
                  hasInfra
                    ? "bg-amber-50/70 border-amber-200 text-amber-900"
                    : "bg-slate-50 border-slate-100 text-slate-400"
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>Infrastructure</span>
                  {hasInfra && <AlertTriangle className="size-3 text-amber-600" />}
                </div>
                <div className="text-[11px] mt-0.5">
                  {hasInfra ? "Active (Docker/K8s/TF)" : "Clean"}
                </div>
              </div>

              <div
                className={`rounded-lg p-2.5 border text-xs ${
                  hasConfig
                    ? "bg-purple-50/70 border-purple-200 text-purple-900"
                    : "bg-slate-50 border-slate-100 text-slate-400"
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>Configuration</span>
                  {hasConfig && <CheckCircle2 className="size-3 text-purple-600" />}
                </div>
                <div className="text-[11px] mt-0.5">
                  {hasConfig ? "Active (.yml/.env/.json)" : "Clean"}
                </div>
              </div>

              <div
                className={`rounded-lg p-2.5 border text-xs ${
                  hasDeps
                    ? "bg-teal-50/70 border-teal-200 text-teal-900"
                    : "bg-slate-50 border-slate-100 text-slate-400"
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>Dependencies</span>
                  {hasDeps && <CheckCircle2 className="size-3 text-teal-600" />}
                </div>
                <div className="text-[11px] mt-0.5">
                  {hasDeps ? "Active (package/lock)" : "Clean"}
                </div>
              </div>
            </div>
          </div>

          {/* Mathematical Formula Explainability Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-4.5 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="size-4 text-amber-400" />
                <span>How This Threshold Was Computed (Formula Math)</span>
              </h4>
              <span className="font-mono text-[10px] text-slate-400">CARF v1.0 Engine</span>
            </div>

            <div className="rounded-lg bg-slate-800/80 p-3 font-mono text-xs text-blue-300 border border-slate-700/60 leading-relaxed overflow-x-auto">
              <div>Threshold = min(BaseThreshold[type] × (1 - Decay × Weight))</div>
              <div className="text-slate-400 text-[11px] mt-1">
                Final = Base ({numThreshold >= 0.05 ? "5.0%" : "3.0%"}) × AST Diff Multiplier → <strong className="text-emerald-400">{thresholdPct}</strong>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 space-y-1 leading-relaxed">
              <p>• <strong>Decay Rate:</strong> Tightens tolerance proportionally as change magnitude increases.</p>
              <p>• <strong>AST Complexity:</strong> Multi-branching logic, cyclomatic deltas, and signature changes further tighten the error budget.</p>
              <p>• <strong>Strictest Wins:</strong> When multiple files are touched (e.g., Code + DB), the most conservative category takes precedence.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <span className="text-xs text-slate-500">
            Push new commits to automatically trigger fresh AST diff evaluations.
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow hover:bg-slate-800 transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
