"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Zap,
  CheckCircle2,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
  Code2,
  RefreshCw,
  Play,
} from "lucide-react";
import type { InstallationRepo } from "../../../adapters/github/reposClient";
import type { AugmentIntegration } from "../../../lib/deploymentMode";
import { projectPageHref } from "../../../lib/dashboardNav";

interface AugmentSetupProps {
  repo: InstallationRepo;
  installationId: string;
  onBackToMode: () => void;
}

export function AugmentSetup({
  repo,
  installationId,
  onBackToMode,
}: AugmentSetupProps) {
  // Sub-step: 1 = Choose Integration, 2 = Commit .carf.yml, 3 = Snippets & Keys, 4 = Verify & Complete
  const [subStep, setSubStep] = useState<1 | 2 | 3 | 4>(1);
  const [integration, setIntegration] = useState<AugmentIntegration>("github-actions");

  // Commit state
  const [committing, setCommitting] = useState<boolean>(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Active snippet tab
  const [activeSnippetTab, setActiveSnippetTab] = useState<AugmentIntegration>("github-actions");
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  // Verification state
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    policyReady: boolean;
    threshold?: number;
    window?: number;
    message?: string;
  } | null>(null);

  const coreApiOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://carf.indevs.in";

  // Commit mode: augment to .carf.yml
  const commitAugmentLink = async () => {
    setCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch("/api/repo/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          owner: repo.owner.login,
          repo: repo.name,
          mode: "augment",
          integration,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit .carf.yml");
      }
      setSubStep(3);
    } catch (err: unknown) {
      setCommitError(err instanceof Error ? err.message : "Failed to link repository");
    } finally {
      setCommitting(false);
    }
  };

  // Run Augment Policy Verification
  const runPolicyVerification = async () => {
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await fetch("/api/repo/augment-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          owner: repo.owner.login,
          repo: repo.name,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationResult(data);
      } else {
        setVerificationResult({
          success: false,
          policyReady: false,
          message: data.error || "Verification failed",
        });
      }
    } catch (err: unknown) {
      setVerificationResult({
        success: false,
        policyReady: false,
        message: err instanceof Error ? err.message : "Verification request failed",
      });
    } finally {
      setVerifying(false);
    }
  };

  // Snippets
  const githubActionsSnippet = `name: CARF Threshold Gate
on: [push]

jobs:
  canary-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Fetch CARF Change-Aware Threshold
        run: |
          RESPONSE=$(curl -fsSL "${coreApiOrigin}/v1/threshold?commit=\${{ github.sha }}" \\
            -H "Authorization: Bearer \${{ secrets.CARF_API_KEY }}")
          
          THRESHOLD=$(echo "$RESPONSE" | jq -r '.threshold')
          WINDOW=$(echo "$RESPONSE" | jq -r '.window')
          echo "Calibrated error threshold: $THRESHOLD across \${WINDOW}s observation window"
          echo "CARF_THRESHOLD=$THRESHOLD" >> $GITHUB_ENV
          echo "CARF_WINDOW=$WINDOW" >> $GITHUB_ENV`;

  const argoRolloutsSnippet = `apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: carf-canary-gate
spec:
  metrics:
  - name: carf-change-aware-threshold
    interval: 30s
    successCondition: result <= 0.05
    provider:
      web:
        url: "${coreApiOrigin}/v1/threshold?owner=${repo.owner.login}&repo=${repo.name}&commit={{args.commit-sha}}"
        headers:
          - key: Authorization
            value: "Bearer {{args.carf-api-key}}"
        jsonPath: "{$.threshold}"`;

  const flaggerSnippet = `apiVersion: flagger.app/v1beta1
kind: MetricTemplate
metadata:
  name: carf-policy-gate
  namespace: test
spec:
  provider:
    type: webhook
    address: "${coreApiOrigin}/v1/threshold?owner=${repo.owner.login}&repo=${repo.name}"
    secretRef:
      name: carf-api-secret`;

  const genericHttpSnippet = `# Query change-aware threshold from your deployment pipeline:
curl -fsSL "${coreApiOrigin}/v1/threshold?owner=${repo.owner.login}&repo=${repo.name}&commit=\${COMMIT_SHA}" \\
  -H "Authorization: Bearer \${CARF_API_KEY}"`;

  const currentSnippet =
    activeSnippetTab === "github-actions"
      ? githubActionsSnippet
      : activeSnippetTab === "argo-rollouts"
      ? argoRolloutsSnippet
      : activeSnippetTab === "flagger"
      ? flaggerSnippet
      : genericHttpSnippet;

  return (
    <div className="space-y-6">
      {/* Substep breadcrumb */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-500 uppercase tracking-wider">
          <span>Augment Configuration</span>
          <span>•</span>
          <span>Step {subStep} of 4</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span>{repo.full_name}</span>
        </div>
      </div>

      {/* SUBSTEP 1: CHOOSE INTEGRATION */}
      {subStep === 1 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-bold text-foreground">Select Deployment CD System</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              CARF provides change-aware threshold policy directly to your deployment orchestrator. Choose which system you use:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                id: "github-actions" as AugmentIntegration,
                title: "GitHub Actions",
                desc: "CI/CD workflows that gate canary or production promotions using dynamic thresholds.",
              },
              {
                id: "argo-rollouts" as AugmentIntegration,
                title: "Argo Rollouts",
                desc: "Kubernetes progressive delivery controller evaluating CARF AnalysisTemplates.",
              },
              {
                id: "flagger" as AugmentIntegration,
                title: "Flagger",
                desc: "Kubernetes progressive delivery using Envoy/Istio/Linkerd and MetricTemplate gates.",
              },
              {
                id: "generic-http" as AugmentIntegration,
                title: "Generic HTTP / API",
                desc: "Custom deployment scripts, Jenkins, GitLab CI, or internal deployment platforms.",
              },
            ].map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setIntegration(item.id);
                  setActiveSnippetTab(item.id);
                }}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  integration === item.id
                    ? "border-blue-500 bg-blue-500/10 shadow-xs ring-1 ring-blue-500"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-foreground">{item.title}</h4>
                  <div
                    className={`size-3.5 rounded-full border flex items-center justify-center ${
                      integration === item.id
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-border"
                    }`}
                  >
                    {integration === item.id && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={onBackToMode}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Mode</span>
            </button>

            <button
              type="button"
              onClick={() => setSubStep(2)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              <span>Next: Configure CARF</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SUBSTEP 2: CONFIGURE CARF (.carf.yml) */}
      {subStep === 2 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-bold text-foreground">Configure CARF Policy (.carf.yml)</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              In Augment mode, CARF acts purely as a change-aware policy engine. No server agent or PM2 adapter is needed.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Generated .carf.yml Configuration</span>
              <span className="text-[10px] font-mono text-muted-foreground">mode: augment</span>
            </div>
            <pre className="rounded-lg bg-slate-950 p-3 font-mono text-xs text-blue-400 overflow-x-auto">
{`# CARF Configuration (Augment Mode)
# Deployment, observability, and rollback are owned by your external CD system.
mode: augment
`}
            </pre>
            <p className="text-[11px] text-muted-foreground">
              Clicking below commits this file to <code className="bg-muted px-1 rounded font-mono">{repo.full_name}</code> on default branch <code className="bg-muted px-1 rounded font-mono">{repo.default_branch}</code>.
            </p>
          </div>

          {commitError && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-rose-600 text-xs">
              {commitError}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setSubStep(1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Integration</span>
            </button>

            <button
              type="button"
              disabled={committing}
              onClick={commitAugmentLink}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
            >
              {committing ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Committing .carf.yml...</span>
                </>
              ) : (
                <>
                  <Code2 className="size-3.5" />
                  <span>Commit .carf.yml & Link Augment Repo</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SUBSTEP 3: SNIPPETS & KEYS */}
      {subStep === 3 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-bold text-foreground">Integration Snippets & Threshold API</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Add this step or template to your deployment pipeline to query CARF change-aware policy:
            </p>
          </div>

          {/* Threshold endpoint display */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">CARF Policy Endpoint:</span>
              <span className="font-mono text-primary font-semibold">GET /v1/threshold</span>
            </div>
            <div className="rounded-lg bg-card border border-border p-2.5 font-mono text-[11px] text-foreground overflow-x-auto select-all">
              {`${coreApiOrigin}/v1/threshold?owner=${repo.owner.login}&repo=${repo.name}&commit=\${COMMIT_SHA}`}
            </div>
          </div>

          {/* Snippet Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 border-b border-border">
                {[
                  { id: "github-actions" as AugmentIntegration, label: "GitHub Actions" },
                  { id: "argo-rollouts" as AugmentIntegration, label: "Argo Rollouts" },
                  { id: "flagger" as AugmentIntegration, label: "Flagger" },
                  { id: "generic-http" as AugmentIntegration, label: "Generic HTTP" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSnippetTab(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors border-b-2 ${
                      activeSnippetTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(currentSnippet);
                  setCopiedSnippet(true);
                  setTimeout(() => setCopiedSnippet(false), 2000);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                {copiedSnippet ? <Check className="size-3" /> : <Copy className="size-3" />}
                <span>{copiedSnippet ? "Copied" : "Copy Snippet"}</span>
              </button>
            </div>

            <pre className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto select-all">
              {currentSnippet}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setSubStep(2)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to .carf.yml</span>
            </button>

            <button
              type="button"
              onClick={() => setSubStep(4)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              <span>Next: Verify Policy</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SUBSTEP 4: VERIFY & COMPLETE */}
      {subStep === 4 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-bold text-foreground">Verify & Complete Onboarding</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Confirm that the repository is linked in Augment mode and the CARF policy engine is responsive.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs pb-3 border-b border-border">
              <span className="text-muted-foreground">Repository:</span>
              <span className="font-semibold text-foreground font-mono">{repo.full_name}</span>

              <span className="text-muted-foreground">Deployment Mode:</span>
              <span className="font-semibold text-blue-500">AUGMENT</span>

              <span className="text-muted-foreground">CD Integration:</span>
              <span className="font-semibold text-foreground capitalize">
                {integration.replace("-", " ")}
              </span>

              <span className="text-muted-foreground">Policy Status:</span>
              <span className="font-semibold text-emerald-500">Connected / Ready</span>
            </div>

            {/* Test button */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h4 className="text-xs font-bold text-foreground">Test CARF Policy Engine</h4>
                <p className="text-[11px] text-muted-foreground">
                  Simulate an inquiry to verify threshold calibration readiness.
                </p>
              </div>

              <button
                type="button"
                disabled={verifying}
                onClick={runPolicyVerification}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
              >
                {verifying ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5 text-emerald-500" />
                )}
                <span>{verifying ? "Testing..." : "Test Policy Engine"}</span>
              </button>
            </div>

            {verificationResult && (
              <div
                className={`rounded-lg border p-3 text-xs ${
                  verificationResult.success
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-rose-500/20 bg-rose-500/10 text-rose-600"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {verificationResult.success ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Zap className="size-4" />
                  )}
                  <span>{verificationResult.message}</span>
                </div>
                {verificationResult.threshold && (
                  <div className="mt-1 text-[11px] font-mono">
                    Baseline threshold: {verificationResult.threshold} | Observation window:{" "}
                    {verificationResult.window}s
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-border">
              <Link
                href={projectPageHref(repo.owner.login, repo.name)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
              >
                <span>Complete & Open Project Dashboard</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
