"use client";

import { useState, useMemo } from "react";
import {
  X,
  Search,
  FolderGit2,
  Terminal,
  Container,
  Server,
  GitBranch,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import type { InstallationRepo } from "../../../../adapters/github/reposClient";
import type { AdapterKind } from "../../../../lib/carfConfigSchema";

export interface LinkProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  installationId: string;
  unlinkedRepos: InstallationRepo[];
  onProjectLinked: (repoFullName: string) => void;
}

const ADAPTER_OPTIONS: Array<{
  kind: AdapterKind;
  label: string;
  icon: typeof Terminal;
  badge: string;
  targetLabel: string;
  placeholder: string;
  description: string;
}> = [
  {
    kind: "pm2",
    label: "PM2 Process Manager",
    icon: Terminal,
    badge: "Zero Downtime",
    targetLabel: "PM2 Process Name",
    placeholder: "e.g. api-server",
    description: "Automatic symlink repointing & 'pm2 reload <target>' zero-downtime cluster rollback.",
  },
  {
    kind: "dockerCompose",
    label: "Docker Compose",
    icon: Container,
    badge: "Container Swap",
    targetLabel: "Docker Compose Service Name",
    placeholder: "e.g. web",
    description: "Redeploys with previous image tag via 'IMAGE_TAG=<baseSha> docker compose up -d <target>'.",
  },
  {
    kind: "kubernetes",
    label: "Kubernetes (kubectl)",
    icon: Server,
    badge: "K8s Rollout",
    targetLabel: "K8s Deployment Name",
    placeholder: "e.g. api-deployment",
    description: "Executes 'kubectl rollout undo deployment/<target>' to revert instantly to the previous ReplicaSet.",
  },
  {
    kind: "gitops",
    label: "GitOps (Argo CD)",
    icon: GitBranch,
    badge: "GitOps Sync",
    targetLabel: "Argo CD Application Name",
    placeholder: "e.g. production-api",
    description: "Triggers 'argocd app rollback <target>' to revert to the previous committed state.",
  },
  {
    kind: "dockerSwarm",
    label: "Docker Swarm",
    icon: Container,
    badge: "Swarm Service",
    targetLabel: "Docker Swarm Service Name",
    placeholder: "e.g. prod_web",
    description: "Rolls back via 'docker service update --rollback <target>'.",
  },
];

export function LinkProjectModal({
  isOpen,
  onClose,
  installationId,
  unlinkedRepos,
  onProjectLinked,
}: LinkProjectModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<InstallationRepo | null>(null);
  const [mode, setMode] = useState<"standalone" | "augment">("standalone");
  const [adapterKind, setAdapterKind] = useState<AdapterKind>("pm2");
  const [adapterTarget, setAdapterTarget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredUnlinkedRepos = useMemo(() => {
    if (!searchQuery.trim()) return unlinkedRepos;
    const q = searchQuery.toLowerCase();
    return unlinkedRepos.filter(
      (r) => r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q)
    );
  }, [unlinkedRepos, searchQuery]);

  if (!isOpen) return null;

  const handleSelectRepo = (repo: InstallationRepo) => {
    setSelectedRepo(repo);
    if (!adapterTarget) {
      setAdapterTarget(repo.name);
    }
    setStep(2);
  };

  const handleLinkProject = async () => {
    if (!selectedRepo) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const [owner, repoName] = selectedRepo.full_name.includes("/")
      ? selectedRepo.full_name.split("/")
      : [selectedRepo.owner.login, selectedRepo.name];

    try {
      const res = await fetch("/api/repo/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          owner,
          repo: repoName,
          mode,
          adapterKind: mode === "standalone" ? adapterKind : undefined,
          adapterTarget: mode === "standalone" ? adapterTarget.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to link project to CARF.");
      }

      setSuccess(`Successfully linked ${selectedRepo.full_name} to CARF with ${mode === "standalone" ? adapterKind : "augment"} mode!`);
      onProjectLinked(selectedRepo.full_name);

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred while linking the project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedRepo(null);
    setSearchQuery("");
    setAdapterTarget("");
    setError(null);
    setSuccess(null);
    onClose();
  };

  const previewYaml =
    mode === "standalone"
      ? `mode: standalone
adapter:
  kind: ${adapterKind}
  target: "${adapterTarget.trim() || "<target-name>"}"

threshold:
  types:
    code:
      baseThreshold: 0.05
      baseWindow: 900
    config:
      baseThreshold: 0.025
      baseWindow: 300
    data:
      baseThreshold: 0.01
      baseWindow: 600`
      : `mode: augment

threshold:
  types:
    code:
      baseThreshold: 0.05
      baseWindow: 900
    config:
      baseThreshold: 0.025
      baseWindow: 300`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Link Repository to CARF
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure fault tolerance and automated rollback protection for your project.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between py-3 border-b border-slate-100 px-1 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                step === 1
                  ? "bg-slate-900 text-white"
                  : step > 1
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {step > 1 ? "✓" : "1"}
            </span>
            <span className={step === 1 ? "font-semibold text-slate-900" : "text-slate-500"}>
              Select Repository
            </span>
          </div>
          <div className="h-px w-6 bg-slate-200" />
          <div className="flex items-center gap-2">
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                step === 2
                  ? "bg-slate-900 text-white"
                  : step > 2
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {step > 2 ? "✓" : "2"}
            </span>
            <span className={step === 2 ? "font-semibold text-slate-900" : "text-slate-500"}>
              Adapter & Mode
            </span>
          </div>
          <div className="h-px w-6 bg-slate-200" />
          <div className="flex items-center gap-2">
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                step === 3
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              3
            </span>
            <span className={step === 3 ? "font-semibold text-slate-900" : "text-slate-500"}>
              Review & Link
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* ── STEP 1: Select Repository ── */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search available repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {filteredUnlinkedRepos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                  {unlinkedRepos.length === 0
                    ? "All repositories in this installation are already protected by CARF!"
                    : `No unlinked repositories match "${searchQuery}".`}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {filteredUnlinkedRepos.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectRepo(r)}
                      className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-900/40 hover:bg-slate-50/80 transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <FolderGit2 className="size-4 text-slate-400 group-hover:text-slate-700" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{r.name}</span>
                            {r.private && (
                              <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[9px] font-medium text-amber-700">
                                Private
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">{r.full_name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                          {r.default_branch || "main"}
                        </span>
                        <ArrowRight className="size-3.5 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Configure Mode & Adapter ── */}
          {step === 2 && selectedRepo && (
            <div className="space-y-4">
              {/* Selected repo banner */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="size-4 text-slate-600" />
                  <span className="font-semibold text-slate-900">{selectedRepo.full_name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2"
                >
                  Change
                </button>
              </div>

              {/* Mode Selection Cards */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900">Rollout Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("standalone")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      mode === "standalone"
                        ? "border-slate-900 bg-slate-900/5 ring-1 ring-slate-900"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-900">Standalone Mode</span>
                      </div>
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                        Recommended
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                      CARF actively monitors canary health and executes automated zero-downtime rollbacks via the configured server adapter.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("augment")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      mode === "augment"
                        ? "border-slate-900 bg-slate-900/5 ring-1 ring-slate-900"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ArrowUpRight className="size-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-900">Augment Mode</span>
                      </div>
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9px] font-semibold text-blue-700">
                        External
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                      CARF evaluates dynamic risk thresholds via API for external rollouts (Argo Rollouts, Flagger, or custom CI).
                    </p>
                  </button>
                </div>
              </div>

              {/* Adapter Selection (if Standalone) */}
              {mode === "standalone" && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900">Deployment Adapter</label>
                    <span className="text-[10px] text-slate-400">Choose your server runtime</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ADAPTER_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = adapterKind === opt.kind;
                      return (
                        <button
                          key={opt.kind}
                          type="button"
                          onClick={() => setAdapterKind(opt.kind)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? "border-slate-900 bg-slate-900/5 ring-1 ring-slate-900"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="size-3.5 text-slate-700" />
                              <span className="text-xs font-semibold text-slate-900">{opt.label}</span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400">{opt.badge}</span>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500 leading-snug">
                            {opt.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Target Input */}
                  <div className="pt-2 space-y-1.5">
                    {(() => {
                      const currentOpt = ADAPTER_OPTIONS.find((a) => a.kind === adapterKind);
                      return (
                        <>
                          <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{currentOpt?.targetLabel ?? "Deployment Target Name"}</span>
                            <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder={currentOpt?.placeholder ?? "e.g. api-server"}
                            value={adapterTarget}
                            onChange={(e) => setAdapterTarget(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                          <p className="text-[11px] text-slate-500">
                            Identifier passed to the adapter when executing health checks and rollbacks.
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Review & Link ── */}
          {step === 3 && selectedRepo && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Repository</span>
                    <p className="font-semibold text-slate-900 font-mono mt-0.5">{selectedRepo.full_name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Mode</span>
                    <p className="font-semibold text-slate-900 capitalize mt-0.5">{mode}</p>
                  </div>
                  {mode === "standalone" && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Adapter & Target</span>
                      <p className="font-semibold text-slate-900 font-mono mt-0.5">
                        {adapterKind} · {adapterTarget.trim()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* YAML Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Generated .carf.yml Configuration</span>
                  <span className="text-[10px] text-slate-400 font-mono">Will be committed to default branch</span>
                </div>
                <pre className="rounded-xl bg-slate-900 p-3.5 font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre">
                  {previewYaml}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {step === 1 && (
              <button
                type="button"
                disabled={!selectedRepo}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <span>Continue</span>
                <ArrowRight className="size-3.5" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                disabled={mode === "standalone" && !adapterTarget.trim()}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <span>Review & Preview</span>
                <ArrowRight className="size-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                disabled={isSubmitting || (mode === "standalone" && !adapterTarget.trim())}
                onClick={handleLinkProject}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Committing .carf.yml…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-3.5" />
                    <span>Commit & Link Project</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
