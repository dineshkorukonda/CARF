import { CheckCircle2, Circle } from "lucide-react";
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
    <div className="flex items-start gap-3 py-3">
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
  const allRepoInstallations = installations.filter((i) => i.repositorySelection === "all").length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8">
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

      <div className="flex divide-x rounded-lg border">
        <div className="flex-1 px-6 py-4">
          <p className="text-2xl font-semibold">{installations.length}</p>
          <p className="text-sm text-muted-foreground">Installations</p>
        </div>
        <div className="flex-1 px-6 py-4">
          <p className="text-2xl font-semibold">{allRepoInstallations}</p>
          <p className="text-sm text-muted-foreground">Installed on all repos</p>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold">Get CARF running</h2>
        <p className="text-sm text-muted-foreground">The steps to go from signed up to actively monitored.</p>
        <div className="mt-3 flex flex-col divide-y">
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
    </main>
  );
}
