"use client";

import React from "react";
import { ArrowLeft, ArrowRight, Server, Zap, CheckCircle2, Check } from "lucide-react";
import type { InstallationRepo } from "../../../adapters/github/reposClient";
import { CARF_TERMS, CAPABILITY_LABELS } from "../../../lib/terminology";

interface DeploymentModeStepProps {
  selectedRepo: InstallationRepo | null;
  selectedMode: "standalone" | "augment" | null;
  onSelectMode: (mode: "standalone" | "augment") => void;
  onBack: () => void;
  onContinue: () => void;
}

export function DeploymentModeStep({
  selectedRepo,
  selectedMode,
  onSelectMode,
  onBack,
  onContinue,
}: DeploymentModeStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <span>Step 2</span>
          <span>•</span>
          <span>{CARF_TERMS.executionMode.label}</span>
        </div>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
          Choose {CARF_TERMS.executionMode.label}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          How does CARF Core evaluate and execute policies for{" "}
          <span className="font-semibold text-foreground font-mono">
            {selectedRepo?.full_name ?? "this repository"}
          </span>
          ?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* STANDALONE CARD */}
        <div
          onClick={() => onSelectMode("standalone")}
          className={`cursor-pointer rounded-xl border p-5 transition-all relative flex flex-col justify-between ${
            selectedMode === "standalone"
              ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary"
              : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
          }`}
        >
          {selectedMode === "standalone" && (
            <div className="absolute top-4 right-4 text-primary">
              <CheckCircle2 className="size-5" />
            </div>
          )}
          <div>
            <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary">
              <Server className="size-5" />
            </div>
            <div className="mt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {CAPABILITY_LABELS.monitoring} &amp; {CAPABILITY_LABELS.rollback}
              </span>
              <h3 className="text-base font-bold text-foreground">Standalone Mode</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              CARF actively monitors the deployment, evaluates the change-aware threshold during the observation window, and executes automated rollback when required.
            </p>

            <ul className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                <span>Supported runtime: <strong className="text-foreground">PM2</strong> process manager</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                <span>Runs lightweight <strong className="text-foreground">CARF Host Agent</strong> on target server</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                <span>Active soak error-rate observation loop</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                <span>Direct rollback execution upon threshold breach</span>
              </li>
            </ul>
          </div>

          <div className="pt-5 mt-4 border-t border-border">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode("standalone");
              }}
              className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
                selectedMode === "standalone"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border bg-muted/40 text-foreground hover:bg-muted"
              }`}
            >
              {selectedMode === "standalone" ? "Selected: Standalone Mode" : "Select Standalone Mode"}
            </button>
          </div>
        </div>

        {/* AUGMENT CARD */}
        <div
          onClick={() => onSelectMode("augment")}
          className={`cursor-pointer rounded-xl border p-5 transition-all relative flex flex-col justify-between ${
            selectedMode === "augment"
              ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary"
              : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
          }`}
        >
          {selectedMode === "augment" && (
            <div className="absolute top-4 right-4 text-primary">
              <CheckCircle2 className="size-5" />
            </div>
          )}
          <div>
            <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-blue-500">
              <Zap className="size-5" />
            </div>
            <div className="mt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                {CAPABILITY_LABELS.policy}
              </span>
              <h3 className="text-base font-bold text-foreground">Augment Mode</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Your deployment system manages rollout, monitoring, and rollback. CARF provides the change-aware threshold and window policy.
            </p>

            <ul className="mt-4 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                <span>Works with <strong className="text-foreground">GitHub Actions, Argo Rollouts, HTTP API</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                <span><strong className="text-foreground">Zero Agent</strong> required on target hosts</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                <span>Dynamic risk-adjusted threshold &amp; window policy</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                <span>Zero server footprint on your deployment infrastructure</span>
              </li>
            </ul>
          </div>

          <div className="pt-5 mt-4 border-t border-border">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode("augment");
              }}
              className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
                selectedMode === "augment"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border bg-muted/40 text-foreground hover:bg-muted"
              }`}
            >
              {selectedMode === "augment" ? "Selected: Augment Mode" : "Select Augment Mode"}
            </button>
          </div>
        </div>
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
          disabled={!selectedMode}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <span>Continue</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
