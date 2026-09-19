"use client";

import { useState } from "react";
import { Info, HelpCircle, ChevronDown, ChevronUp, BookOpen, Sparkles, CheckCircle2, ShieldAlert } from "lucide-react";
import { SetupGuideModal } from "./SetupGuideModal";

export type TabKey = "status" | "adapter" | "rules" | "analytics";

interface TabExplainerBannerProps {
  tab: TabKey;
  installationId: string;
  repoName?: string;
  defaultMode?: "standalone" | "augment";
}

const TAB_INFO: Record<
  TabKey,
  {
    title: string;
    subtitle: string;
    purpose: string;
    doINeedThis: string;
    tip: string;
  }
> = {
  status: {
    title: "Live Rollout Status",
    subtitle: "Real-time stream of commits analyzed by CARF's AST engine.",
    purpose:
      "Whenever you git push, CARF captures the commit, inspects the AST diff, calculates a dynamic error tolerance threshold and soak window, and displays the risk verdict here.",
    doINeedThis:
      "This is your primary observability hub. You do NOT need to manually trigger anything — it updates automatically on every push.",
    tip: "Click on any commit row to inspect the full AST structural diff, modified functions, and step-by-step mathematical threshold formula.",
  },
  adapter: {
    title: "Deployment Adapter & Presets",
    subtitle: "Configure where and how your application runs (PM2, Vercel, Render, Docker, Kubernetes).",
    purpose:
      "Allows you to switch between Augment Mode (CARF advises CI/CD or PR checks) and Standalone Mode (CARF directly drives health-check and rollback loops).",
    doINeedThis:
      "You only need to visit this tab once during initial setup or when changing your deployment infrastructure. Once configured, you can leave it as is.",
    tip: "If your app is deployed on Vercel, Render, or PM2, check the Setup Guide for ready-to-use snippets.",
  },
  rules: {
    title: "Custom Sensitivity Rules",
    subtitle: "Fine-tune risk weights for sensitive paths like /auth, /payments, or database schemas.",
    purpose:
      "CARF calculates risk automatically using Tree-sitter AST parsing. This tab lets you declare custom override rules (e.g., 'always make changes under src/billing/ 10x stricter').",
    doINeedThis:
      "Completely optional! CARF's built-in AST classifier works automatically out of the box. You only need rules if your team has specific high-risk directories.",
    tip: "Rules you define here take priority over default AST sensitivity weights.",
  },
  analytics: {
    title: "Rollout Analytics & Telemetry",
    subtitle: "Historical deployment trends, clean vs. rolled back stats, and MTTR insights.",
    purpose:
      "Aggregates deployment outcomes over time, helping engineering and SRE teams track how dynamic thresholding reduces false-positive rollbacks.",
    doINeedThis:
      "Optional review page. Check this periodically to see how your deployments are performing across releases.",
    tip: "Telemetry is automatically recorded for every completed deployment window.",
  },
};

export function TabExplainerBanner({
  tab,
  installationId,
  repoName,
  defaultMode = "augment",
}: TabExplainerBannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const info = TAB_INFO[tab];

  return (
    <>
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <BookOpen className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-sm">{info.title} Guide</span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                  {defaultMode === "standalone" ? "Standalone Mode" : "Augment / Advisory Mode"}
                </span>
              </div>
              <p className="text-xs text-slate-600">{info.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 shadow-sm hover:bg-blue-50 transition-colors"
            >
              <Sparkles className="size-3.5 text-blue-600" />
              <span>Setup Guide & Presets</span>
            </button>
            <button
              onClick={() => setIsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <HelpCircle className="size-3.5" />
              <span>{isOpen ? "Hide Notes" : "What is this?"}</span>
              {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="mt-3 grid gap-3 border-t border-blue-100/80 pt-3 text-xs text-slate-700 md:grid-cols-3">
            <div className="rounded-lg bg-white/80 p-3 border border-slate-100 shadow-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-900 mb-1">
                <Info className="size-3.5 text-blue-600" />
                <span>What does this tab do?</span>
              </div>
              <p className="text-slate-600 leading-relaxed">{info.purpose}</p>
            </div>

            <div className="rounded-lg bg-white/80 p-3 border border-slate-100 shadow-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-900 mb-1">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                <span>Do I need to touch this?</span>
              </div>
              <p className="text-slate-600 leading-relaxed">{info.doINeedThis}</p>
            </div>

            <div className="rounded-lg bg-white/80 p-3 border border-slate-100 shadow-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-900 mb-1">
                <Sparkles className="size-3.5 text-amber-500" />
                <span>Pro Tip</span>
              </div>
              <p className="text-slate-600 leading-relaxed">{info.tip}</p>
            </div>
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
