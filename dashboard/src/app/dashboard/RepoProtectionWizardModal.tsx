"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Zap,
  X,
  FileCode2,
  GitBranch,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ExternalLink,
} from "lucide-react";
import type { ProtectionPreset } from "../../lib/repoProtectionTemplates";
import { generateCarfYaml, generateWatchdogWorkflowYaml } from "../../lib/repoProtectionTemplates";

export interface RepoProtectionWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  installationId: string;
  repo: { name: string; full_name: string };
  onProtectionSuccess?: (repoFullName: string) => void;
}

export function RepoProtectionWizardModal({
  isOpen,
  onClose,
  installationId,
  repo,
  onProtectionSuccess,
}: RepoProtectionWizardModalProps) {
  const [preset, setPreset] = useState<ProtectionPreset>("standard");
  const [includeWorkflow, setIncludeWorkflow] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"carf" | "workflow">("carf");

  if (!isOpen) return null;

  const [owner, repoName] = repo.full_name.includes("/")
    ? repo.full_name.split("/")
    : ["", repo.name];

  const handleProtect = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/repo/protect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          owner,
          repo: repoName,
          preset,
          includeWorkflow,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit protection configuration.");
      }

      setSuccess(data.message || `Successfully committed protection files to ${repo.full_name}!`);
      if (onProtectionSuccess) {
        onProtectionSuccess(repo.full_name);
      }
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewCarfYaml = generateCarfYaml(preset);
  const previewWorkflowYaml = generateWatchdogWorkflowYaml();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Zap className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                1-Click Repository Protection Wizard
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{repo.full_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 py-4 space-y-5 pr-1">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
              <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Commit Failed</p>
                <p className="mt-0.5 text-red-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold">Repository Protected!</p>
                <p className="mt-0.5 text-emerald-700">{success}</p>
              </div>
            </div>
          )}

          {/* Preset Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-900 uppercase tracking-wider block mb-2 font-mono">
              1. Select Risk Profile Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPreset("standard")}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  preset === "standard"
                    ? "border-slate-900 bg-slate-50/70 ring-1 ring-slate-900"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Standard</span>
                  <span className="text-[10px] font-mono font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  0.5% base, 3.5% max cap, 180s observation window.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPreset("conservative")}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  preset === "conservative"
                    ? "border-slate-900 bg-slate-50/70 ring-1 ring-slate-900"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-xs font-bold text-slate-900">Conservative</span>
                <p className="text-[11px] text-slate-500 mt-1">
                  0.2% base, 2.0% max cap, 300s observation window.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPreset("aggressive")}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  preset === "aggressive"
                    ? "border-slate-900 bg-slate-50/70 ring-1 ring-slate-900"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-xs font-bold text-slate-900">Aggressive</span>
                <p className="text-[11px] text-slate-500 mt-1">
                  1.0% base, 5.0% max cap, 120s observation window.
                </p>
              </button>
            </div>
          </div>

          {/* Workflow Checkbox */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWorkflow}
                onChange={(e) => setIncludeWorkflow(e.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900">
                  Add GitHub Actions Canary Watchdog Workflow
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Creates <code className="font-mono text-slate-800">.github/workflows/carf.yml</code> to run AST and change-vector verification on every push and PR.
                </p>
              </div>
            </label>
          </div>

          {/* Preview Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider font-mono">
                2. Files to be Committed
              </span>
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setActiveTab("carf")}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeTab === "carf"
                      ? "bg-slate-900 text-white font-semibold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  .carf.yml
                </button>
                {includeWorkflow && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("workflow")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      activeTab === "workflow"
                        ? "bg-slate-900 text-white font-semibold"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    .github/workflows/carf.yml
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-950 p-3.5 text-[11px] font-mono text-slate-100 overflow-x-auto max-h-52">
              <pre className="leading-relaxed">
                {activeTab === "carf" ? previewCarfYaml : previewWorkflowYaml}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleProtect}
            disabled={isSubmitting || !!success}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Committing via GitHub App...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                <span>Protected!</span>
              </>
            ) : (
              <>
                <Zap className="size-3.5 text-amber-300" />
                <span>Commit & Protect Repository</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
