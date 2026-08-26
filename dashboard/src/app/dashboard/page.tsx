import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { getCurrentAccount } from "../../lib/auth";
import { listInstallationsForAccount } from "../../lib/accountService";
import { prisma } from "../../lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_install_state: "GitHub App install request expired or was tampered with. Please try again.",
  install_link_failed: "Couldn't confirm the new installation with GitHub. Please try again.",
  not_authorized: "That installation isn't linked to your account.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) {
    redirect("/login");
  }

  const { error } = await searchParams;
  const installations = await listInstallationsForAccount(prisma, account.id);

  return (
    <main className="max-w-[720px] mx-auto px-6 py-16 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Welcome, {account.githubLogin}</h1>
          <p className="text-sm text-muted-foreground">Manage which repos CARF can roll back for you.</p>
        </div>
        <form action="/api/auth/logout" method="POST">
          <Button variant="outline" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </div>

      {error && <p className="text-sm text-destructive">{ERROR_MESSAGES[error] ?? "Something went wrong."}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Connected repositories</CardTitle>
          <CardDescription>Installations of the CARF GitHub App tied to your account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {installations.length === 0 && (
            <p className="text-sm text-muted-foreground">No installations yet.</p>
          )}
          {installations.map((installation) => (
            <div key={installation.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{installation.targetLogin}</p>
                <p className="text-xs text-muted-foreground">
                  installation {installation.installationId} · {installation.repositorySelection} repos
                </p>
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
          <Button render={<a href="/api/github-app/install/start" />} className="self-start">
            Install the CARF GitHub App
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
