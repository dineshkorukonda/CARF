import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { env } from "../../../../config/env";
import { signGithubAppJwt } from "../../../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../../../adapters/github/installationTokenClient";
import { listInstallationRepos } from "../../../../adapters/github/reposClient";
import { getCarfConfigFile } from "../../../../adapters/github/contentsClient";
import { load } from "js-yaml";
import { LIVE_ADAPTER_KINDS, type AdapterKind } from "../../../../lib/carfConfigSchema";
import { ConfigModeForm } from "./ConfigModeForm";

const ERROR_MESSAGES: Record<string, string> = {
  save_failed: "Couldn't save .carf.yml -- please try again.",
  not_authorized: "That installation isn't linked to your account.",
};

interface ExistingModeAdapter {
  mode?: "standalone" | "augment";
  adapter?: { kind?: string; target?: string };
}

export default async function ConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ installationId: string }>;
  searchParams: Promise<{ repo?: string; error?: string; saved?: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const { installationId } = await params;
  const { repo: repoParam, error, saved } = await searchParams;

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) redirect("/dashboard?error=not_authorized");

  const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
  const { token } = await createInstallationToken(installationId, appJwt);
  const repos = await listInstallationRepos(token);

  const selectedFullName = repoParam ?? (repos.length === 1 ? repos[0]!.full_name : undefined);

  if (!selectedFullName) {
    return (
      <main className="flex max-w-xl flex-col gap-6 p-8">
        <div>
          <h1 className="text-xl font-semibold">Choose a repository</h1>
          <p className="text-sm text-muted-foreground">
            Installation <code className="rounded bg-muted px-1 py-0.5">{installationId}</code> covers {repos.length}{" "}
            repositories.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {repos.map((r) => (
            <a
              key={r.id}
              href={`/dashboard/config/${installationId}?repo=${encodeURIComponent(r.full_name)}`}
              className="rounded-sm border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              {r.full_name}
            </a>
          ))}
        </div>
      </main>
    );
  }

  const [owner, repoName] = selectedFullName.split("/");
  const file = await getCarfConfigFile(owner!, repoName!, token);
  const existing = (file ? (load(file.content) as ExistingModeAdapter | undefined) : undefined) ?? {};

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">{installation.targetLogin}</h1>
        <p className="text-sm text-muted-foreground">
          {selectedFullName} -- saves generate a commit to <code>.carf.yml</code>.
        </p>
      </div>

      {error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}
      {saved && (
        <p className="rounded-sm bg-primary/10 px-3 py-2 text-sm text-primary">
          Saved -- committed to {selectedFullName}.
        </p>
      )}

      <div>
        <h2 className="text-base font-semibold">Deployment & Rollback Mode</h2>
        <p className="text-sm text-muted-foreground">
          Configure how CARF integrates with your deployments for this repository.
        </p>
        <ConfigModeForm
          installationId={installationId}
          owner={owner}
          repo={repoName}
          defaultMode={existing.mode === "standalone" ? "standalone" : "augment"}
          defaultAdapterKind={(existing.adapter?.kind as AdapterKind) ?? LIVE_ADAPTER_KINDS[0]}
          defaultAdapterTarget={existing.adapter?.target ?? ""}
        />
      </div>
    </main>
  );
}
