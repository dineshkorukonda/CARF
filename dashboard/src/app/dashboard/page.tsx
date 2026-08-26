import { Boxes, CheckCircle2, Circle, GitPullRequestArrow } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";

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
    <div className="flex items-start gap-3 py-2.5">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/40" />
      )}
      <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {!done && action && (
          <Button size="sm" variant="outline" render={<a href={action.href} />}>
            {action.label}
          </Button>
        )}
      </div>
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

  return (
    <main className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">
          {greeting()}, <span className="text-muted-foreground">{account.email.split("@")[0]}</span>
        </h1>
        <p className="text-sm text-muted-foreground">Here&apos;s an overview of what CARF is watching for you.</p>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-transparent bg-foreground text-background">
          <CardHeader className="gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-background/15">
              <Boxes className="size-4.5" />
            </span>
            <div>
              <CardDescription className="font-mono text-xs tracking-wide text-background/70 uppercase">
                Installations
              </CardDescription>
              <CardTitle className="font-mono text-2xl font-semibold text-background">
                {installations.length}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <GitPullRequestArrow className="size-4.5" />
            </span>
            <div>
              <CardDescription className="font-mono text-xs tracking-wide uppercase">
                Installed on all repos
              </CardDescription>
              <CardTitle className="font-mono text-2xl font-semibold">
                {installations.filter((i) => i.repositorySelection === "all").length}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Get CARF running</CardTitle>
          <CardDescription>The steps to go from signed up to actively monitored.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
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
        </CardContent>
      </Card>
    </main>
  );
}
