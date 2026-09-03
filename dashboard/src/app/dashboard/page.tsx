import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";
import { ensureCoreApiKey } from "../../lib/coreApiAccess";
import {
  Terminal,
  Container,
  Server,
  Radio,
  Settings2,
  Sliders,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Boxes,
} from "lucide-react";
import Link from "next/link";
import { ApiKeyCopyButton } from "./installations/ApiKeyCopyButton";

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized: "That installation isn't linked to your account.",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const account = (await getCurrentAccount())!;
  const { error } = await searchParams;
  const installations = await listInstallationsForAccount(prisma, account.id);
  const primaryInstallation = installations[0];
  const hasInstallation = installations.length > 0;

  let primaryApiKey: string | null = null;
  if (primaryInstallation) {
    try {
      primaryApiKey = await ensureCoreApiKey(prisma, primaryInstallation);
    } catch {
      // Non-fatal
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>CARF Control Center</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {greeting()}, {account.email.split("@")[0]}
          </h1>
        </div>

        {hasInstallation ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/status/${primaryInstallation.installationId}`}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              <Radio className="size-3.5" />
              <span>View Live Status</span>
            </Link>
          </div>
        ) : (
          <Link
            href="/dashboard/installations"
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            <Boxes className="size-3.5" />
            <span>Connect GitHub Repo</span>
          </Link>
        )}
      </div>

      {error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}

      {/* Active Workspace Banner */}
      {primaryInstallation && (
        <div className="rounded-sm border border-border bg-card p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span className="font-semibold text-base text-foreground">
                {primaryInstallation.targetLogin}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                id: {primaryInstallation.installationId}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Watching {primaryInstallation.repositorySelection === "all" ? "all repositories" : "selected repositories"}{" "}
              with dynamic AST risk analysis and automated rollback defense.
            </p>
          </div>

          {primaryApiKey && (
            <div className="flex items-center gap-2 rounded bg-muted/50 px-3 py-2 border border-border/50 text-xs">
              <span className="text-muted-foreground font-medium">Core API Key:</span>
              <ApiKeyCopyButton apiKey={primaryApiKey} />
            </div>
          )}
        </div>
      )}

      {/* Clear 3-Step Fast Path Tracker */}
      <div className="rounded-sm border border-border bg-card p-6 shadow-xs">
        <div className="mb-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
            Fast-Path Setup & Monitoring
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Three simple steps to fully safeguard your deployments with CARF.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className={`p-4 rounded-sm border ${hasInstallation ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/20"} flex flex-col justify-between gap-3`}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Step 1</span>
                {hasInstallation ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" /> Connected
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Required</span>
                )}
              </div>
              <h3 className="font-semibold text-sm text-foreground">Install GitHub App</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your GitHub repositories so CARF receives commit push webhooks.
              </p>
            </div>
            <Link
              href="/dashboard/installations"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4"
            >
              <span>{hasInstallation ? "Manage Repos" : "Install Now"}</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-sm border border-border bg-card flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Step 2</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Adapter
                </span>
              </div>
              <h3 className="font-semibold text-sm text-foreground">Configure Rollback Engine</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose PM2, Docker Compose, Swarm, Kubernetes, or Augment Mode.
              </p>
            </div>
            {primaryInstallation ? (
              <Link
                href={`/dashboard/config/${primaryInstallation.installationId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4"
              >
                <span>Select Adapter</span>
                <ArrowRight className="size-3" />
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">Available after Step 1</span>
            )}
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-sm border border-border bg-card flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Step 3</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <Radio className="size-3.5" /> Live
                </span>
              </div>
              <h3 className="font-semibold text-sm text-foreground">Deploy & Observe</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Push code; CARF computes AST complexity deltas and watches telemetry.
              </p>
            </div>
            {primaryInstallation ? (
              <Link
                href={`/dashboard/status/${primaryInstallation.installationId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4"
              >
                <span>Live Feed</span>
                <ArrowRight className="size-3" />
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">Available after Step 1</span>
            )}
          </div>
        </div>
      </div>

      {/* 4 Core Functional Action Cards */}
      {primaryInstallation && (
        <div>
          <div className="mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Repository Operations
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href={`/dashboard/status/${primaryInstallation.installationId}`}
              className="group p-5 rounded-sm border border-border bg-card hover:border-primary/50 transition-colors flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                  <Radio className="size-4 text-emerald-500 shrink-0" />
                  <span>Live Rollout Status</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Real-time classified commits table with dynamic error thresholds, AST complexity deltas, and rollback outcomes.
                </p>
              </div>
              <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Open Status Monitor →
              </span>
            </Link>

            <Link
              href={`/dashboard/config/${primaryInstallation.installationId}`}
              className="group p-5 rounded-sm border border-border bg-card hover:border-primary/50 transition-colors flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                  <Settings2 className="size-4 text-primary shrink-0" />
                  <span>Deployment Adapter</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configure PM2 zero-downtime symlink reloads, Docker Compose tag reversions, or Kubernetes rollout undo.
                </p>
              </div>
              <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Configure Engine →
              </span>
            </Link>

            <Link
              href={`/dashboard/config/${primaryInstallation.installationId}/rules`}
              className="group p-5 rounded-sm border border-border bg-card hover:border-primary/50 transition-colors flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                  <Sliders className="size-4 text-primary shrink-0" />
                  <span>Threshold & Classification Rules</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tune sensitivity percentages, decay factors, and path rules for code, config, infra, and database migrations.
                </p>
              </div>
              <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Edit Rules →
              </span>
            </Link>

            <Link
              href={`/dashboard/analytics/${primaryInstallation.installationId}`}
              className="group p-5 rounded-sm border border-border bg-card hover:border-primary/50 transition-colors flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                  <BarChart3 className="size-4 text-primary shrink-0" />
                  <span>Health & Rollout Analytics</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Overall deployment stability rates, rollback ratios, and change type distribution charts.
                </p>
              </div>
              <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                View Analytics →
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* Deployment Engine Showcase & Fast Guides */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Deployment Engine Architecture
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            CARF executes zero-downtime rollbacks directly on your target server or cluster.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-sm border border-border p-4 bg-card flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Terminal className="size-4 text-primary shrink-0" />
                <span>PM2 (VPS / Bare Metal)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Swaps <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">/var/www/current</code> symlink back to previous release SHA and signals <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">pm2 reload</code>.
              </p>
            </div>
            {primaryInstallation ? (
              <Link
                href={`/dashboard/config/${primaryInstallation.installationId}`}
                className="text-xs font-semibold text-primary hover:underline underline-offset-4 self-start"
              >
                Configure PM2 →
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">Install app to configure</span>
            )}
          </div>

          <div className="rounded-sm border border-border p-4 bg-card flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Container className="size-4 text-primary shrink-0" />
                <span>Docker Compose</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Redeploys the previous image revision with <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">IMAGE_TAG=&lt;baseSha&gt; docker compose up -d</code> on health check failure.
              </p>
            </div>
            {primaryInstallation ? (
              <Link
                href={`/dashboard/config/${primaryInstallation.installationId}`}
                className="text-xs font-semibold text-primary hover:underline underline-offset-4 self-start"
              >
                Configure Docker →
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">Install app to configure</span>
            )}
          </div>

          <div className="rounded-sm border border-border p-4 bg-card flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Server className="size-4 text-primary shrink-0" />
                <span>Kubernetes & Swarm</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Executes native cluster rollback via <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">kubectl rollout undo</code> or Swarm rolling rollbacks.
              </p>
            </div>
            {primaryInstallation ? (
              <Link
                href={`/dashboard/config/${primaryInstallation.installationId}`}
                className="text-xs font-semibold text-primary hover:underline underline-offset-4 self-start"
              >
                Configure Cluster →
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">Install app to configure</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
