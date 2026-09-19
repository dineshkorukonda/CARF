"use client";

import { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Server,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowUpRight,
  RotateCcw,
} from "lucide-react";
import type { RecentCommit } from "../../../../adapters/coreApi/client";

interface AdvisoryAlertBannerProps {
  commits: RecentCommit[];
  repoFullName?: string;
  onOpenSetupGuide?: () => void;
}

export function AdvisoryAlertBanner({
  commits,
  repoFullName,
  onOpenSetupGuide,
}: AdvisoryAlertBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check recent commits for any high risk or rolled back commits
  const highRiskCommits = commits.filter(
    (c) => c.finalThreshold !== null && c.finalThreshold < 0.015
  );
  const latestCommit = commits[0];

  const hasCriticalRisk = highRiskCommits.length > 0;

  return (
    <div
      className={`rounded-xl border p-4 transition-all shadow-xs ${
        hasCriticalRisk
          ? "border-amber-200 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40"
          : "border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/30"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              hasCriticalRisk
                ? "bg-amber-500 text-white"
                : "bg-blue-600 text-white"
            } shadow-2xs`}
          >
            {hasCriticalRisk ? (
              <AlertTriangle className="size-4" />
            ) : (
              <ShieldAlert className="size-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-sm">
                Advisory & Smart Alert Mode Active
              </span>
              <span className="rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Vercel · Render · PM2 · Cloud
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {hasCriticalRisk
                ? `⚠️ Caution: ${highRiskCommits.length} recent commit(s) modify high-sensitivity paths (DB/Infra).`
                : "CARF actively monitors AST risk budgets and surfaces real-time deployment alerts."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSetupGuide && (
            <button
              onClick={onOpenSetupGuide}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <Sparkles className="size-3 text-blue-600" />
              <span>Platform Presets</span>
            </button>
          )}
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <span>{isExpanded ? "Hide Details" : "Quick Actions"}</span>
            {isExpanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3.5 border-t border-slate-200/80 pt-3.5 space-y-3 text-xs text-slate-700">
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Vercel Action */}
            <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span className="flex items-center gap-1.5">
                  <Globe className="size-3.5 text-blue-600" />
                  <span>Vercel / Next.js</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Advisory</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                To roll back on Vercel if an alert occurs:
              </p>
              <div className="rounded bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-100 select-all">
                vercel rollback
              </div>
            </div>

            {/* Render Action */}
            <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span className="flex items-center gap-1.5">
                  <Server className="size-3.5 text-indigo-600" />
                  <span>Render.com</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Deploy Hook</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Trigger redeploy of stable commit on Render:
              </p>
              <div className="rounded bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-100 select-all">
                curl -X POST https://api.render.com/deploy/...
              </div>
            </div>

            {/* PM2 Action */}
            <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span className="flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-emerald-600" />
                  <span>PM2 Server</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Zero-Downtime</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Revert symlink and reload worker cluster:
              </p>
              <div className="rounded bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-100 select-all">
                ln -sfn releases/prev current && pm2 reload
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
