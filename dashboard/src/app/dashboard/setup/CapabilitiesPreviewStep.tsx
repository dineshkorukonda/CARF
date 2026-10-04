"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { InstallationRepo } from "../../../adapters/github/reposClient";
import {
  resolveCapabilities,
  type DeploymentIntegration,
  type RuntimeAdapter,
} from "../../../lib/capabilities";
import { projectPageHref } from "../../../lib/dashboardNav";

interface CapabilitiesPreviewStepProps {
  repo: InstallationRepo;
  installationId: string;
  deploymentIntegration: DeploymentIntegration;
  runtimeAdapter: RuntimeAdapter;
  pm2Config: {
    targetName: string;
    cwd: string;
    healthUrl: string;
    buildCommand: string;
    layout: "releases" | "git";
  };
  onBack: () => void;
}

export function CapabilitiesPreviewStep({
  repo,
  installationId,
  deploymentIntegration,
  runtimeAdapter,
  pm2Config,
  onBack,
}: CapabilitiesPreviewStepProps) {
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [installToken, setInstallToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const resolved = resolveCapabilities(deploymentIntegration, runtimeAdapter);
  const isPm2 = runtimeAdapter === "pm2";

  const carfYamlPreview = `# .carf.yml — CARF 3-Layer Architecture Configuration
deploymentIntegration: "${deploymentIntegration}"
runtimeAdapter: "${runtimeAdapter}"
mode: "${resolved.capabilities.rollback ? "standalone" : "augment"}"
${
  runtimeAdapter === "pm2"
    ? `adapter:
  kind: pm2
  target: "${pm2Config.targetName || repo.name}"
  cwd: "${pm2Config.cwd}"
  healthUrl: "${pm2Config.healthUrl}"
  layout: "${pm2Config.layout}"${pm2Config.buildCommand.trim() ? `
  buildCommand: ${JSON.stringify(pm2Config.buildCommand.trim())}` : ""}`
    : ""
}`.trim();

  const handleConnect = async () => {
    setLinking(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        installationId,
        owner: repo.owner.login,
        repo: repo.name,
        deploymentIntegration,
        runtimeAdapter,
        mode: resolved.capabilities.rollback ? "standalone" : "augment",
        ...(runtimeAdapter === "pm2"
          ? {
              adapterKind: "pm2",
              adapterTarget: pm2Config.targetName || repo.name,
              cwd: pm2Config.cwd,
              healthUrl: pm2Config.healthUrl,
              ...(pm2Config.buildCommand.trim() ? { buildCommand: pm2Config.buildCommand.trim() } : {}),
              layout: pm2Config.layout,
            }
          : {}),
      };

      const res = await fetch("/api/repo/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect repository");
      }

      setConnected(true);
      if (data.installToken && !isPm2) {
        setInstallToken(data.installToken);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLinking(false);
    }
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const agentInstallCommand = installToken
    ? `curl -fsSL https://carf.sh/install | bash -s -- --token ${installToken}`
    : "";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <span>Step 4</span>
          <span>•</span>
          <span>Layer Resolution & Confirmation</span>
        </div>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
          Live Capabilities Preview
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Review the resolved capabilities for{" "}
          <span className="font-semibold text-foreground font-mono">{repo.full_name}</span>{" "}
          before committing configuration.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Capabilities Matrix Card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Resolved Architecture Matrix</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Layer 1: CARF Core
            </span>
            <div className="mt-1.5 flex items-center gap-1.5 font-bold text-xs text-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Policy & Risk Engine</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Diff analysis, classification, and dynamic error-rate thresholding.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Layer 2: Deployment
            </span>
            <div className="mt-1.5 flex items-center gap-1.5 font-bold text-xs text-foreground">
              <span
                className={`size-2 rounded-full ${
                  resolved.deploymentStatus === "active" ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              <span>{resolved.integrationLabel}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Delivery channel for triggers and policy injection.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Layer 3: Runtime
            </span>
            <div className="mt-1.5 flex items-center gap-1.5 font-bold text-xs text-foreground">
              <span
                className={`size-2 rounded-full ${
                  resolved.runtimeStatus === "active" ? "bg-emerald-500" : "bg-muted-foreground"
                }`}
              />
              <span>{resolved.runtimeLabel}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isPm2
                ? "Direct local PM2 adapter with live rollback."
                : resolved.requiresAgent
                ? "Host agent with live rollback."
                : "Zero host agent required."}
            </p>
          </div>
        </div>

        {/* Feature Checkmarks */}
        <div className="border-t border-border pt-3">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span className="text-foreground font-medium">Risk Vector & Churn Scoring</span>
            </div>

            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span className="text-foreground font-medium">Dynamic Error-Rate Thresholds</span>
            </div>

            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span className="text-foreground font-medium">Dynamic Soak Window Duration</span>
            </div>

            <div className="flex items-center gap-2">
              {resolved.capabilities.monitoring ? (
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="size-4 text-muted-foreground/40 shrink-0" />
              )}
              <span
                className={
                  resolved.capabilities.monitoring
                    ? "text-foreground font-medium"
                    : "text-muted-foreground line-through"
                }
              >
                Runtime Telemetry Monitoring
              </span>
            </div>

            <div className="flex items-center gap-2">
              {resolved.capabilities.rollback ? (
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="size-4 text-muted-foreground/40 shrink-0" />
              )}
              <span
                className={
                  resolved.capabilities.rollback
                    ? "text-foreground font-medium"
                    : "text-muted-foreground line-through"
                }
              >
                Automated Deployment Rollback
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="size-4 flex items-center justify-center font-bold text-xs text-primary">
                ℹ
              </span>
              <span className="text-muted-foreground">
                Agent:{" "}
                <strong className="text-foreground">
                  {resolved.requiresAgent ? "Required (Host Agent)" : "Zero Agent Required"}
                </strong>
              </span>
            </div>
          </dl>
        </div>
      </div>

      {/* YAML Preview */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground font-mono">.carf.yml to be committed</span>
          <button
            type="button"
            onClick={() => copyToClipboard(carfYamlPreview, setCopiedSnippet)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {copiedSnippet ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            <span>{copiedSnippet ? "Copied" : "Copy YAML"}</span>
          </button>
        </div>
        <pre className="rounded-lg bg-muted/60 p-3 font-mono text-[11px] leading-relaxed text-foreground overflow-x-auto">
          {carfYamlPreview}
        </pre>
      </div>

      {/* Success State */}
      {connected ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/[0.04] p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-5" />
            <h3 className="font-bold text-sm">Repository Connected Successfully!</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {isPm2
              ? "PM2 configuration is saved. Open project Settings to verify the runtime and configure GitHub Actions. Automatic deployment starts after the CI-gated workflow is installed."
              : resolved.requiresAgent
              ? "The configuration was committed to .carf.yml. Now install the CARF Host Agent on your target server to begin live observability."
              : "The configuration was committed to .carf.yml. Policy-only integration is active with zero server agent footprint required."}
          </p>

          {installToken && !isPm2 && (
            <div className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Host Agent One-Line Installer</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(agentInstallCommand, setCopiedToken)}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  {copiedToken ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  <span>{copiedToken ? "Copied command" : "Copy command"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto rounded bg-muted/80 p-2 font-mono text-[11px] text-foreground">
                {agentInstallCommand}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Link
              href={projectPageHref(repo.owner.login, repo.name)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <span>View Repository Dashboard</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <button
            type="button"
            onClick={onBack}
            disabled={linking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleConnect}
            disabled={linking}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {linking ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            <span>{linking ? "Connecting..." : "Commit & Connect Repository"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
