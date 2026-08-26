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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // layout.tsx already redirects to /login if there's no session.
  const account = (await getCurrentAccount())!;
  const { error } = await searchParams;
  const installations = await listInstallationsForAccount(prisma, account.id);

  return (
    <main className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-lg font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Repos CARF is watching for you.</p>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="gap-1">
            <CardDescription>Installations</CardDescription>
            <CardTitle className="text-2xl font-semibold">{installations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="gap-1">
            <CardDescription>Standalone-managed repos</CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {installations.filter((i) => i.repositorySelection === "all").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

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
                  Status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  render={<a href={`/dashboard/config/${installation.installationId}`} />}
                >
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
              Link installation
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
