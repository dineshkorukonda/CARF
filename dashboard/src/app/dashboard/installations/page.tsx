import { Radio, Settings2, Sliders, BarChart3, Plus } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { getCurrentAccount } from "../../../lib/auth";
import { listInstallationsForAccount } from "../../../lib/accountService";
import { prisma } from "../../../lib/prisma";
import Link from "next/link";
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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">GitHub Installations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Repositories connected to CARF for automated risk analysis and rollback protection.
          </p>
        </div>
        <Button render={<a href="/api/github-app/install/start" />} className="self-start sm:self-auto gap-1.5">
          <Plus className="size-4" />
          <span>Install on New Repo</span>
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}

      {installations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border px-4 py-12 text-center bg-card">
          <p className="text-sm font-medium text-foreground">No repositories connected yet</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Install the CARF GitHub App on your repositories to enable continuous commit classification, dynamic error budgets, and zero-downtime rollbacks.
          </p>
          <Button render={<a href="/api/github-app/install/start" />} className="mt-2">
            Install the CARF GitHub App
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {installations.map((installation) => (
            <div
              key={installation.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-sm border border-border bg-card shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-sm font-semibold text-foreground">{installation.targetLogin}</span>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {installation.targetType}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    id: {installation.installationId}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Scope:{" "}
                    <span className="font-medium text-foreground">
                      {installation.repositorySelection === "all" ? "All repositories" : "Selected repositories"}
                    </span>
                  </span>
                  {installation.coreApiKey && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1.5">
                        API Key: <ApiKeyCopyButton apiKey={installation.coreApiKey} />
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/dashboard/status/${installation.installationId}`}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-muted/60 hover:bg-muted text-foreground px-2.5 py-1.5 text-xs font-medium border border-border transition-colors"
                >
                  <Radio className="size-3 text-emerald-500" />
                  <span>Status</span>
                </Link>
                <Link
                  href={`/dashboard/config/${installation.installationId}`}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-muted/60 hover:bg-muted text-foreground px-2.5 py-1.5 text-xs font-medium border border-border transition-colors"
                >
                  <Settings2 className="size-3" />
                  <span>Adapter</span>
                </Link>
                <Link
                  href={`/dashboard/config/${installation.installationId}/rules`}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-muted/60 hover:bg-muted text-foreground px-2.5 py-1.5 text-xs font-medium border border-border transition-colors"
                >
                  <Sliders className="size-3" />
                  <span>Rules</span>
                </Link>
                <Link
                  href={`/dashboard/analytics/${installation.installationId}`}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-muted/60 hover:bg-muted text-foreground px-2.5 py-1.5 text-xs font-medium border border-border transition-colors"
                >
                  <BarChart3 className="size-3" />
                  <span>Analytics</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-sm border border-border bg-muted/20 p-5 mt-2 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Missing an installation?
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          If GitHub didn&apos;t automatically redirect back here after installing the app, you can manually link the installation using its numerical ID from your GitHub App settings URL.
        </p>
        <form action="/api/github-app/install/manual" method="POST" className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            name="installationId"
            placeholder="e.g. 62762744"
            inputMode="numeric"
            className="max-w-56 font-mono text-xs"
          />
          <Button type="submit" variant="outline" size="sm">
            Link Installation
          </Button>
        </form>
      </div>
    </main>
  );
}
