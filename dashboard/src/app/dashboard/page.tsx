import { Boxes, CheckCircle2, Circle, GitPullRequestArrow, KeyRound, Radio, Settings2, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_install_state: "GitHub App install request expired or was tampered with. Please try again.",
  install_link_failed: "Couldn't confirm that installation with GitHub -- check the id and try again.",
  invalid_installation_id: "That doesn't look like a valid installation id (numbers only).",
  not_authorized: "That installation isn't linked to your account.",
};

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
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-transparent bg-foreground text-background shadow-sm">
          <CardHeader className="gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-background/15">
              <Boxes className="size-4.5" />
            </span>
            <div>
              <CardDescription className="text-background/70">Installations</CardDescription>
              <CardTitle className="text-2xl font-semibold text-background">{installations.length}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <GitPullRequestArrow className="size-4.5" />
            </span>
            <div>
              <CardDescription>Installed on all repos</CardDescription>
              <CardTitle className="text-2xl font-semibold">
                {installations.filter((i) => i.repositorySelection === "all").length}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card className="shadow-sm">
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
            action={{ label: "Install", href: "/api/github-app/install/start" }}
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Connected repositories</CardTitle>
          <CardDescription>Installations of the CARF GitHub App tied to your account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {installations.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No installations yet. Install the CARF GitHub App on a repo to get started.
              </p>
              <Button render={<a href="/api/github-app/install/start" />}>Install the CARF GitHub App</Button>
            </div>
          )}
          {installations.map((installation) => (
            <div
              key={installation.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-sm font-medium">{installation.targetLogin}</p>
                  <p className="text-xs text-muted-foreground">
                    installation {installation.installationId} · {installation.repositorySelection} repos
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{installation.targetType}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  render={<a href={`/dashboard/status/${installation.installationId}`} />}
                >
                  <Radio className="size-3.5" />
                  Status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  render={<a href={`/dashboard/config/${installation.installationId}`} />}
                >
                  <Settings2 className="size-3.5" />
                  Configure
                </Button>
              </div>
            </div>
          ))}
          {installations.length > 0 && (
            <Button variant="outline" render={<a href="/api/github-app/install/start" />} className="self-start">
              Install on another repo
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <KeyRound className="size-4.5" />
          </span>
          <CardTitle>Already installed, but not showing up?</CardTitle>
          <CardDescription>
            If GitHub didn&apos;t redirect back here after install, paste the installation id from the
            app&apos;s GitHub page (or the URL after installing) to link it manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/github-app/install/manual" method="POST" className="flex items-end gap-3">
            <div className="flex flex-1 max-w-xs flex-col gap-1.5">
              <Label htmlFor="installationId">Installation id</Label>
              <Input id="installationId" name="installationId" placeholder="e.g. 156767738" inputMode="numeric" />
            </div>
            <Button type="submit" variant="outline">
              <SlidersHorizontal className="size-3.5" />
              Link installation
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
