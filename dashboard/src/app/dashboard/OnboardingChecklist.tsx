"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCode2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { SetupGuideModal } from "./SetupGuideModal";

interface OnboardingChecklistProps {
  installationId: string;
  repoName: string;
  totalCommits: number;
  hasCarfConfig?: boolean;
}

export function OnboardingChecklist({
  installationId,
  repoName,
  totalCommits,
  hasCarfConfig = true,
}: OnboardingChecklistProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const steps = [
    {
      id: "repo-connected",
      label: "GitHub Repository Linked",
      description: `Connected @${repoName} via GitHub App (ID #${installationId}).`,
      completed: true,
    },
    {
      id: "stack-detected",
      label: "Stack Auto-Recognized",
      description: "CARF AST engine mapped stack semantics (PM2, Vercel, Render, Docker, or K8s).",
      completed: true,
    },
    {
      id: "config-ready",
      label: ".carf.yml Config Active",
      description: hasCarfConfig
        ? "Dynamic tolerance rules and soak windows configured."
        : "Add .carf.yml to root to customize base tolerance and observation window.",
      completed: hasCarfConfig,
      action: !hasCarfConfig
        ? {
            label: "Configure .carf.yml",
            onClick: () => setIsGuideOpen(true),
          }
        : undefined,
    },
    {
      id: "first-commit",
      label: "Commits Analyzed by Tree-sitter AST",
      description:
        totalCommits > 0
          ? `${totalCommits} commit(s) successfully scored with dynamic risk budgets.`
          : "Push a commit to GitHub to trigger your first live AST diff risk analysis.",
      completed: totalCommits > 0,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);
  const isAllComplete = completedCount === steps.length;

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                isAllComplete
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 text-white"
              } shadow-2xs`}
            >
              {isAllComplete ? (
                <ShieldCheck className="size-4" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900">
                  Integration Readiness Checklist
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    isAllComplete
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
                >
                  {progressPct}% Protected
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isAllComplete
                  ? "Repository is fully protected. CARF dynamically scores every git push."
                  : "Complete these steps to fully activate dynamic rollback tolerance."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              <FileCode2 className="size-3 text-blue-600" />
              <span>View Presets</span>
            </button>
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title={isExpanded ? "Collapse checklist" : "Expand checklist"}
            >
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isAllComplete ? "bg-emerald-500" : "bg-blue-600"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Steps List */}
        {isExpanded && (
          <div className="grid gap-2 sm:grid-cols-2 pt-1">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-colors ${
                  step.completed
                    ? "bg-emerald-50/40 border-emerald-200/60 text-slate-800"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {step.completed ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <Circle className="size-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 flex items-center justify-between">
                    <span>{step.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {step.description}
                  </p>
                  {step.action && (
                    <button
                      onClick={step.action.onClick}
                      className="mt-1.5 inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                    >
                      <span>{step.action.label}</span>
                      <ArrowRight className="size-2.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SetupGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        installationId={installationId}
        repoName={repoName}
      />
    </>
  );
}
