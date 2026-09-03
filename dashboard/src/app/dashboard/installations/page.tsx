import { Radio, Settings2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { getCurrentAccount } from "../../../lib/auth";
import { listInstallationsForAccount } from "../../../lib/accountService";
import { prisma } from "../../../lib/prisma";

import { ApiKeyCopyButton } from "./ApiKeyCopyButton";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_install_state: "GitHub App install request expired or was tampered with. Please try again.",
  install_link_failed: "Couldn't confirm that installation with GitHub -- check the id and try again.",
  invalid_installation_id: "That doesn't look like a valid installation id (numbers only).",
  not_authorized: "That installation isn't linked to your account.",
};

export default async function InstallationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // layout.tsx already redirects to /login if there's no session.
  const account = (await getCurrentAccount())!;
  const { error } = await searchParams;
  const installations = await listInstallationsForAccount(prisma, account.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Installations</h1>
          <p className="text-sm text-muted-foreground">Repos the CARF GitHub App is watching for you.</p>
        </div>
        {installations.length > 0 && (
          <Button render={<a href="/api/github-app/install/start" />}>Install on another repo</Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}

      {installations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border px-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No installations yet. Install the CARF GitHub App on a repo to get started.
          </p>
          <Button render={<a href="/api/github-app/install/start" />}>Install the CARF GitHub App</Button>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-sm border border-border">
          {installations.map((installation) => (
            <div key={installation.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-sm font-medium">{installation.targetLogin}</p>
                  <p className="text-xs text-muted-foreground">
                    installation <span className="font-mono">{installation.installationId}</span> ·{" "}
                    {installation.repositorySelection} repos
                    {installation.coreApiKey && (
                      <span className="inline-flex items-center gap-1.5 pl-1">
                        · key: <ApiKeyCopyButton apiKey={installation.coreApiKey} />
                      </span>
                    )}
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
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium">Already installed, but not showing up?</p>
        <p className="text-xs text-muted-foreground">
          If GitHub didn&apos;t redirect back here after install, paste the installation id from the app&apos;s
          GitHub page (or the URL after installing) to link it manually.
        </p>
        <form action="/api/github-app/install/manual" method="POST" className="mt-3 flex items-center gap-2">
          <Input
            name="installationId"
            placeholder="e.g. 156767738"
            inputMode="numeric"
            className="max-w-56"
          />
          <Button type="submit" variant="outline" size="sm">
            Link installation
          </Button>
        </form>
      </div>
    </main>
  );
}
