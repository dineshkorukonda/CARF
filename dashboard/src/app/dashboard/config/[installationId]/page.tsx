import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
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
      <main className="max-w-[560px] mx-auto px-6 py-16 flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Choose a repository</h1>
        <p className="text-sm text-muted-foreground">
          Installation <code>{installationId}</code> covers {repos.length} repositories.
        </p>
        <div className="flex flex-col gap-2">
          {repos.map((r) => (
            <a
              key={r.id}
              href={`/dashboard/config/${installationId}?repo=${encodeURIComponent(r.full_name)}`}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted"
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
    <main className="max-w-[560px] mx-auto px-6 py-16 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Mode &amp; adapter</h1>
        <p className="text-sm text-muted-foreground">
          {selectedFullName} -- saves generate a commit to <code>.carf.yml</code>.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{ERROR_MESSAGES[error] ?? "Something went wrong."}</p>}
      {saved && <p className="text-sm text-green-700">Saved -- committed to {selectedFullName}.</p>}

      <Card>
        <CardHeader>
          <CardTitle>Standalone rollback</CardTitle>
          <CardDescription>Augment mode leaves rollback to your own pipeline; Standalone has CARF drive it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/config/save" method="POST" className="flex flex-col gap-4">
            <input type="hidden" name="installationId" value={installationId} />
            <input type="hidden" name="owner" value={owner} />
            <input type="hidden" name="repo" value={repoName} />

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Mode</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="mode" value="augment" defaultChecked={existing.mode !== "standalone"} />
                Augment
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="mode" value="standalone" defaultChecked={existing.mode === "standalone"} />
                Standalone
              </label>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Adapter (Standalone only)</legend>
              <select
                name="adapterKind"
                defaultValue={existing.adapter?.kind ?? LIVE_ADAPTER_KINDS[0]}
                className="rounded-md border px-2 py-1.5 text-sm"
              >
                {LIVE_ADAPTER_KINDS.map((kind: AdapterKind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="adapterTarget"
                placeholder="e.g. my-deployment"
                defaultValue={existing.adapter?.target ?? ""}
                className="rounded-md border px-2 py-1.5 text-sm"
              />
            </fieldset>

            <Button type="submit" className="self-start">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
