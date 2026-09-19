"use client";

import { useState } from "react";
import {
  Sparkles,
  Terminal,
  Globe,
  Server,
  Container,
  Layers,
  ArrowRight,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { detectStackFromRepo, type StackDetectionResult } from "../../lib/stackDetector";
import { SetupGuideModal } from "./SetupGuideModal";

interface StackRecognitionBannerProps {
  repoName: string;
  installationId: string;
}

function StackIcon({ stack, className }: { stack: string; className?: string }) {
  switch (stack) {
    case "vercel":
      return <Globe className={className} />;
    case "render":
      return <Server className={className} />;
    case "pm2":
      return <Terminal className={className} />;
    case "docker":
      return <Container className={className} />;
    case "k8s":
      return <Layers className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

export function StackRecognitionBanner({
  repoName,
  installationId,
}: StackRecognitionBannerProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const detected: StackDetectionResult = detectStackFromRepo(repoName);

  const handleCopy = () => {
    navigator.clipboard.writeText(detected.sampleYml);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <>
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <StackIcon stack={detected.stack} className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-sm">
                  ✨ Auto-Detected Stack: {detected.label}
                </span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                  {detected.badge}
                </span>
              </div>
              <p className="text-xs text-slate-600">{detected.reason}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              {isCopied ? (
                <Check className="size-3 text-emerald-600" />
              ) : (
                <Copy className="size-3 text-slate-500" />
              )}
              <span>{isCopied ? "Copied .carf.yml" : "Copy Recommended .carf.yml"}</span>
            </button>
            <button
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs transition-colors"
            >
              <span>Setup Guide</span>
              <ArrowRight className="size-3" />
            </button>
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 transition-colors"
              title={isExpanded ? "Collapse" : "Expand details"}
            >
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3.5 border-t border-indigo-100 pt-3.5 text-xs text-slate-700 space-y-2">
            <div className="rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-100 overflow-x-auto">
              <code>{detected.sampleYml}</code>
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
