"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import type { CompatibilityReport } from "../../../lib/compatCheck";
import type { RecentCommit } from "../../../adapters/coreApi/client";
import { GithubAppProbeCard } from "../installations/GithubAppProbeCard";

export interface OnboardingStatus {
  currentStep: number;
  installationId?: string;
  repo?: string;
  repos?: Array<{ name: string; full_name: string }>;
  step1: { completed: boolean };
  step2: { completed: boolean; repoCount?: number };
  step3: { completed: boolean; report?: CompatibilityReport };
  step4: { completed: boolean };
  step5: { completed: boolean; commit?: RecentCommit; totalCommits?: number };
}

export function OnboardingStepper({ initial }: { initial: OnboardingStatus }) {
  const [status, setStatus] = useState<OnboardingStatus>(initial);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/status");
      if (res.ok) {
        const body = await res.json();
        setStatus(body);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">CARF Onboarding Stepper</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Five verified stages to bring a repository under Change-Aware Rollback protection.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <RefreshCw className={"size-3 " + (loading ? "animate-spin" : "")} />
          <span>Refresh state</span>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* Step 1 */}
        <div className={"rounded-sm border p-4 transition-colors " + (status.step1.completed ? "border-border bg-card" : "border-primary/50 bg-card shadow-xs ring-1 ring-primary/20")}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {status.step1.completed ? <CheckCircle2 className="size-5 text-emerald-500" /> : <div className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</div>}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">1. Connect GitHub</span>
                {status.step1.completed && <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">Completed</Badge>}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Authenticate and authorize the CARF GitHub App to inspect deployments and rollback triggers.</p>
              <div className="pt-2">
                {!status.step1.completed ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button render={<a href="/api/github-app/install/start" />} size="sm"><span>Connect GitHub App</span><ArrowRight className="size-3.5 ml-1" /></Button>
                    <Link href="/dashboard/installations" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">Manual link / Diagnostics</Link>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-emerald-500">GitHub App authorization verified</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className={"rounded-sm border p-4 transition-colors " + (status.step2.completed ? "border-border bg-card" : status.currentStep === 2 ? "border-primary/50 bg-card shadow-xs ring-1 ring-primary/20" : "border-border/50 bg-muted/10 opacity-70")}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {status.step2.completed ? <CheckCircle2 className="size-5 text-emerald-500" /> : <div className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</div>}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">2. Install on a Target Repository</span>
                {status.step2.completed && <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">Completed</Badge>}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Select repositories to grant CARF webhook ingestion and file tree read permissions.</p>
              <div className="pt-2">
                {!status.step2.completed ? (
                  <div className="flex items-center gap-2">
                    <Button render={<a href="/api/github-app/install/start" />} size="sm"><span>Select Repositories</span><ExternalLink className="size-3 ml-1" /></Button>
                    <Link href="/dashboard/installations" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">Manual link</Link>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-muted-foreground">Installed on <strong className="text-foreground">{status.repo ?? "target repository"}</strong></span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className={"rounded-sm border p-4 transition-colors " + (status.step3.completed ? "border-border bg-card" : status.currentStep === 3 ? "border-primary/50 bg-card shadow-xs ring-1 ring-primary/20" : "border-border/50 bg-muted/10 opacity-70")}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {status.step3.completed ? <CheckCircle2 className="size-5 text-emerald-500" /> : <div className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">3</div>}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">3. Compatibility & Stack Detection</span>
                {status.step3.completed && <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">Completed</Badge>}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Scans repository tree for PM2, Docker Compose, Kubernetes, or Serverless/CI deployment artifacts.</p>
              <div className="pt-2">
                {status.step3.report ? (
                  <div className="rounded-sm border border-border bg-muted/30 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <span>Recommended Mode: {status.step3.report.recommendedMode}</span>
                      {status.step3.report.recommendedAdapter && <Badge variant="secondary" className="font-mono text-[10px]">{status.step3.report.recommendedAdapter}</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{status.step3.report.summary}</p>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Scans automatically when repository is selected.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className={"rounded-sm border p-4 transition-colors " + (status.step4.completed ? "border-border bg-card" : status.currentStep === 4 ? "border-primary/50 bg-card shadow-xs ring-1 ring-primary/20" : "border-border/50 bg-muted/10 opacity-70")}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {status.step4.completed ? <CheckCircle2 className="size-5 text-emerald-500" /> : <div className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">4</div>}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">4. Configure Mode & Adapter (.carf.yml)</span>
                {status.step4.completed && <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">Completed</Badge>}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Pre-fills mode and adapter recommendations and commits .carf.yml directly to the repository via GitHub App.</p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {status.installationId ? (
                  <Button render={<a href={"/dashboard/config/" + status.installationId + (status.repo ? "?repo=" + encodeURIComponent(status.repo) : "")} />} size="sm">
                    <span>{status.step4.completed ? "Edit Configuration" : "Configure Mode & Adapter"}</span>
                    <ArrowRight className="size-3.5 ml-1" />
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Requires installation</span>
                )}
                {status.step4.completed && <span className="text-xs font-mono text-emerald-500">.carf.yml committed</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className={"rounded-sm border p-4 transition-colors " + (status.step5.completed ? "border-border bg-card" : status.currentStep === 5 ? "border-primary/50 bg-card shadow-xs ring-1 ring-primary/20" : "border-border/50 bg-muted/10 opacity-70")}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {status.step5.completed ? <CheckCircle2 className="size-5 text-emerald-500" /> : <div className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">5</div>}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">5. First Commit Classified</span>
                {status.step5.completed && <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">Completed</Badge>}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Polls core-api until a commit diff is classified into AST change types with computed error thresholds.</p>
              <div className="pt-2">
                {status.step5.completed && status.step5.commit ? (
                  <div className="rounded-sm border border-border bg-muted/30 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-mono">
                      <span>Commit: {status.step5.commit.sha.slice(0, 7)}</span>
                      <span className="text-emerald-500 font-semibold">Classified</span>
                    </div>
                    <div className="flex gap-1">
                      {status.step5.commit.activeTypes.map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-[10px] font-mono capitalize">{t}</Badge>
                      ))}
                    </div>
                    <div className="pt-2">
                      <Button render={<a href={"/dashboard/status/" + status.installationId} />} size="sm" className="w-full">
                        <span>Go to Live Rollout Status →</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-sm border border-dashed border-border p-3 text-xs text-muted-foreground space-y-2">
                    <p>No commits classified yet. Push a commit to your connected repository to see live classification output.</p>
                    {status.installationId && (
                      <Link href={"/dashboard/status/" + status.installationId} className="text-[11px] underline underline-offset-2 hover:text-foreground">
                        Proceed directly to Status page
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <GithubAppProbeCard />
      </div>
    </div>
  );
}