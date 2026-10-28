"use client";

import React from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, GitBranch, Layers, Webhook } from "lucide-react";
import type { InstallationRepo } from "../../../adapters/github/reposClient";
import type { DeploymentIntegration } from "../../../lib/capabilities";
import type { AnalysisTrigger } from "../../../lib/carfConfigSchema";
import { AnalysisTriggerSelect } from "../../../components/AnalysisTriggerSelect";
import { CARF_TERMS, SETUP_EXPLANATIONS } from "../../../lib/terminology";

interface DeploymentIntegrationStepProps {
  selectedRepo: InstallationRepo | null;
  selectedIntegration: DeploymentIntegration;
  analysisTrigger: AnalysisTrigger;
  onAnalysisTriggerChange: (trigger: AnalysisTrigger) => void;
  analysisLoading?: boolean;
  analysisError?: string | null;
  onSelectIntegration: (integration: DeploymentIntegration) => void;
  onBack: () => void;
  onContinue: () => void;
}

interface IntegrationOption {
  id: DeploymentIntegration;
  name: string;
  tag: string;
  tagColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  features: string[];
}

const INTEGRATION_OPTIONS: IntegrationOption[] = [
  {
    id: "github_actions",
    name: "GitHub Actions",
    tag: "Active · Recommended",
    tagColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: GitBranch,
    description: "Automated workflow-driven policy checks via GitHub Actions with branch and PR inspection.",
    features: [
      "Direct GitHub App integration",
      "Automatic or manual .github/workflows/carf.yml",
      "Outputs dynamic threshold & soak window to job matrix",
    ],
  },
  {
    id: "argo_rollouts",
    name: "Argo Rollouts",
    tag: "Active",
    tagColor: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    icon: Layers,
    description: "Progressive delivery controller for Kubernetes with automated canary analysis.",
    features: [
      "Dynamic AnalysisTemplate threshold injection",
      "Kubernetes canary & blue-green step evaluation",
      "Webhook-driven metric verification",
    ],
  },
  {
    id: "generic_http",
    name: "Generic CI / Webhook",
    tag: "Active",
    tagColor: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    icon: Webhook,
    description: "Integrate any CI/CD runner (GitLab, Jenkins, CircleCI) via standard REST API.",
    features: [
      "Simple HTTP POST /v1/augment/threshold",
      "Bearer API Key authentication",
      "Returns JSON risk vector and error-rate threshold",
    ],
  },
];

export function DeploymentIntegrationStep({
  selectedRepo,
  selectedIntegration,
  analysisTrigger,
  onAnalysisTriggerChange,
  analysisLoading,
  analysisError,
  onSelectIntegration,
  onBack,
  onContinue,
}: DeploymentIntegrationStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <span>Step 2</span>
          <span>•</span>
          <span>Layer 2: {CARF_TERMS.deploymentIntegration.label}</span>
        </div>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
          Choose {CARF_TERMS.deploymentIntegration.label}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {SETUP_EXPLANATIONS.deploymentIntegration} Selected repository:{" "}
          <span className="font-semibold text-foreground font-mono">
            {selectedRepo?.full_name ?? "this repository"}
          </span>.
        </p>
      </div>

      <div className="border-b border-border pb-5">
        <AnalysisTriggerSelect value={analysisTrigger} onChange={onAnalysisTriggerChange} disabled={analysisLoading || Boolean(analysisError)} />
        {analysisLoading && <p role="status" className="mt-2 text-xs text-muted-foreground">Loading saved analysis settings…</p>}
        {analysisError && <p role="alert" className="mt-2 text-xs text-destructive">{analysisError} Reload to try again.</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTEGRATION_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selectedIntegration === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => onSelectIntegration(opt.id)}
              className={`cursor-pointer rounded-xl border p-5 transition-all relative flex flex-col justify-between ${
                isSelected
                  ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary"
                  : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 text-primary">
                  <CheckCircle2 className="size-5" />
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${opt.tagColor}`}>
                    {opt.tag}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-base font-bold text-foreground">{opt.name}</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {opt.description}
                </p>

                <ul className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                  {opt.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 mt-4 border-t border-border">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectIntegration(opt.id);
                  }}
                  className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "border border-border bg-muted/40 text-foreground hover:bg-muted"
                  }`}
                >
                  {isSelected ? `Selected: ${opt.name}` : `Select ${opt.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={analysisLoading || Boolean(analysisError)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <span>Next: {CARF_TERMS.runtimeIntegration.label}</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
