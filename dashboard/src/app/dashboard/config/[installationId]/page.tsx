import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../../components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
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
              className="rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted"
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
    <main className="mx-auto flex max-w-[560px] flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Mode &amp; adapter</h1>
          <p className="text-sm text-muted-foreground">
            {selectedFullName} -- saves generate a commit to <code>.carf.yml</code>.
          </p>
        </div>
        <a
          href={`/dashboard/config/${installationId}/rules?repo=${encodeURIComponent(selectedFullName)}`}
          className="shrink-0 text-sm font-medium underline underline-offset-4"
        >
          Classification &amp; threshold →
        </a>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}
      {saved && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          Saved -- committed to {selectedFullName}.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Standalone rollback</CardTitle>
          <CardDescription>Augment mode leaves rollback to your own pipeline; Standalone has CARF drive it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/config/save" method="POST" className="flex flex-col gap-5">
            <input type="hidden" name="installationId" value={installationId} />
            <input type="hidden" name="owner" value={owner} />
            <input type="hidden" name="repo" value={repoName} />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Mode</legend>
              <RadioGroup name="mode" defaultValue={existing.mode === "standalone" ? "standalone" : "augment"}>
                <Label className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value="augment" />
                  Augment
                </Label>
                <Label className="flex items-center gap-2 font-normal">
                  <RadioGroupItem value="standalone" />
                  Standalone
                </Label>
              </RadioGroup>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Adapter (Standalone only)</legend>
              <Select name="adapterKind" defaultValue={existing.adapter?.kind ?? LIVE_ADAPTER_KINDS[0]}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIVE_ADAPTER_KINDS.map((kind: AdapterKind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text"
                name="adapterTarget"
                placeholder="e.g. my-deployment"
                defaultValue={existing.adapter?.target ?? ""}
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
