import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";
import { Terminal, Container, Server } from "lucide-react";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized: "That installation isn't linked to your account.",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SetupStep({
  done,
  title,
  description,
  action,
}: {
  done: boolean;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="grid grid-cols-[24px_1fr_auto] items-center gap-4 border-b border-border py-3.5 last:border-0">
      <div className={"font-mono text-xs " + (done ? "text-primary" : "text-muted-foreground/50")}>
        {done ? "✓" : "·"}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {!done && action ? (
        <a href={action.href} className="text-xs font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4">
          {action.label.toUpperCase()} →
        </a>
      ) : (
        <div />
      )}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // layout.tsx already redirects to /login if there's no session.
  const account = (await getCurrentAccount())!;
  const { error } = await searchParams;
  const installations = await listInstallationsForAccount(prisma, account.id);
  const primaryInstallation = installations[0];
  const hasInstallation = installations.length > 0;
  const allRepoInstallations = installations.filter((i) => i.repositorySelection === "all").length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 p-8">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Home</p>
        <h1 className="mt-1 text-2xl font-semibold">
          {greeting()}, {account.email.split("@")[0]}
        </h1>
      </div>

      {error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-px border border-border bg-border">
        <div className="bg-background px-6 py-5">
          <div className="font-mono text-3xl font-medium">{String(installations.length).padStart(2, "0")}</div>
          <div className="mt-1.5 text-xs text-muted-foreground">Installation{installations.length === 1 ? "" : "s"}</div>
        </div>
        <div className="bg-background px-6 py-5">
          <div className="font-mono text-3xl font-medium">{String(allRepoInstallations).padStart(2, "0")}</div>
          <div className="mt-1.5 text-xs text-muted-foreground">On all repos</div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Get CARF running</p>
        <p className="mt-1 text-sm text-muted-foreground">The steps to go from signed up to actively monitored.</p>
        <div className="mt-4 border-t border-border">
          <SetupStep done title="Create your account" description="You're signed in." />
          <SetupStep
            done={hasInstallation}
            title="Install the CARF GitHub App"
            description="Grants CARF access to classify commits on your repo(s)."
            action={{ label: "Install", href: "/dashboard/installations" }}
          />
          <SetupStep
            done={hasInstallation}
            title="Configure mode & adapter"
            description="Choose Augment or Standalone, and (for Standalone) a rollback target."
            action={
              primaryInstallation
                ? { label: "Configure", href: `/dashboard/config/${primaryInstallation.installationId}` }
                : undefined
            }
          />
          <SetupStep
            done={hasInstallation}
            title="Set classification & threshold rules"
            description="Tune which changes count as risky and how long CARF watches them."
            action={
              primaryInstallation
                ? { label: "Configure", href: `/dashboard/config/${primaryInstallation.installationId}/rules` }
                : undefined
            }
          />
          <SetupStep
            done={hasInstallation}
            title="Watch live status"
            description="See classified commits and rollout outcomes as they happen."
            action={
              primaryInstallation
                ? { label: "View status", href: `/dashboard/status/${primaryInstallation.installationId}` }
                : undefined
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Supported Deployment Engines</p>
          <p className="mt-1 text-sm text-muted-foreground">
            CARF supports zero-downtime automated rollbacks directly on your servers or clusters.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-sm border border-border p-4 bg-card flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Terminal className="size-4 text-primary shrink-0" />
                <span>PM2 (Server / VPS)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Atomic release symlinks (<code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">/var/www/current</code>) with zero-downtime <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">pm2 reload</code> on threshold breach.
              </p>
            </div>
            {primaryInstallation ? (
              <Link
                href={`/dashboard/config/${primaryInstallation.installationId}`}
                className="text-xs font-medium text-primary hover:underline underline-offset-4 self-start"
              >
                Configure PM2 adapter →
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
                Inspects container health checks and rolls back using <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">IMAGE_TAG</code> redeployments on single Linux VMs.
              </p>
            </div>
            {primaryInstallation ? (
              <Link
                href={`/dashboard/config/${primaryInstallation.installationId}`}
                className="text-xs font-medium text-primary hover:underline underline-offset-4 self-start"
              >
                Configure Docker adapter →
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
                Native cluster commands (<code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">kubectl rollout undo</code> and Swarm rolling rollbacks) for container fleets.
              </p>
            </div>
            {primaryInstallation ? (
              <Link
                href={`/dashboard/config/${primaryInstallation.installationId}`}
                className="text-xs font-medium text-primary hover:underline underline-offset-4 self-start"
              >
                Configure Cluster adapter →
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
