import Link from "next/link";
import { redirect } from "next/navigation";
import { load } from "js-yaml";
import { CheckCircle2, Radio, ArrowRight } from "lucide-react";
import { getCurrentAccount } from "../../../../../lib/auth";
import { getInstallationForAccount } from "../../../../../lib/accountService";
import { prisma } from "../../../../../lib/prisma";
import { mintInstallationToken } from "../../../../../lib/installationAccess";
import { listInstallationRepos } from "../../../../../adapters/github/reposClient";
import { getCarfConfigFile } from "../../../../../adapters/github/contentsClient";
import type { ThresholdChangeType } from "../../../../../lib/carfConfigSchema";
import { RulesForm, type RulesFormInitial } from "./RulesForm";
import { ensureCoreApiKey } from "../../../../../lib/coreApiAccess";
import { RepoNavigationTabs } from "../../../RepoNavigationTabs";

interface ExistingClassificationThreshold {
  classification?: { rules?: Array<{ type: string; patterns: string[] }> };
  threshold?: {
    decay?: number;
    complexityDecay?: number;
    types?: Partial<Record<ThresholdChangeType, { baseThreshold?: number; baseWindow?: number }>>;
  };
}

const THRESHOLD_TYPES: readonly ThresholdChangeType[] = ["infra", "dependency", "config", "code", "data"];

function toFormInitial(existing: ExistingClassificationThreshold): RulesFormInitial {
  return {
    rules: (existing.classification?.rules ?? []).map((r) => ({
      type: r.type as RulesFormInitial["rules"][number]["type"],
      patternsText: r.patterns.join("\n"),
    })),
    decay: existing.threshold?.decay !== undefined ? String(existing.threshold.decay) : "",
    complexityDecay: existing.threshold?.complexityDecay !== undefined ? String(existing.threshold.complexityDecay) : "",
    types: Object.fromEntries(
      THRESHOLD_TYPES.map((t) => [
        t,
        {
          baseThreshold:
            existing.threshold?.types?.[t]?.baseThreshold !== undefined
              ? String(existing.threshold.types[t]!.baseThreshold)
              : "",
          baseWindow:
            existing.threshold?.types?.[t]?.baseWindow !== undefined ? String(existing.threshold.types[t]!.baseWindow) : "",
        },
      ])
    ) as RulesFormInitial["types"],
  };
}

const ERROR_MESSAGES: Record<string, string> = {
  save_failed: "Failed to commit config changes to repository. Please try again.",
  permissions: "GitHub App is missing 'Contents: Read and write' permissions. Please update your GitHub App repository permissions to 'Read and write' and accept them for this repository.",
  branch_protected: "Cannot commit directly: the default branch has branch protection or rulesets enabled.",
  conflict: "Conflict writing .carf.yml: the file was modified concurrently. Please refresh and try again.",
  not_authorized: "That installation isn't linked to your account.",
};

export default async function RulesPage({
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

  let apiKey: string | null = null;
  try {
    apiKey = await ensureCoreApiKey(prisma, installation);
  } catch {
    // Non-fatal
  }

  const token = await mintInstallationToken(installationId);
  const repos = await listInstallationRepos(token);
  const selectedFullName = repoParam ?? (repos.length === 1 ? repos[0]!.full_name : undefined);

  if (!selectedFullName) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
        <RepoNavigationTabs
          installationId={installationId}
          repoName={installation.targetLogin}
          apiKey={apiKey}
        />
        <div>
          <h1 className="text-xl font-semibold">Choose a repository</h1>
          <p className="text-sm text-muted-foreground">Select a repository to tune classification rules and thresholds.</p>
        </div>
        <div className="flex flex-col gap-2">
          {repos.map((r) => (
            <a
              key={r.id}
              href={`/dashboard/config/${installationId}/rules?repo=${encodeURIComponent(r.full_name)}`}
              className="rounded-sm border border-border px-4 py-3 text-sm transition-colors hover:bg-muted font-medium flex items-center justify-between"
            >
              <span>{r.full_name}</span>
              <span className="text-xs text-muted-foreground">Tune Rules →</span>
            </a>
          ))}
        </div>
      </main>
    );
  }

  const [owner, repoName] = selectedFullName.split("/");
  const file = await getCarfConfigFile(owner!, repoName!, token);
  const existing = (file ? (load(file.content) as ExistingClassificationThreshold | undefined) : undefined) ?? {};

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <RepoNavigationTabs
        installationId={installationId}
        repoName={selectedFullName}
        apiKey={apiKey}
      />

      <div>
        <h1 className="text-xl font-semibold">Classification & Dynamic Threshold Rules</h1>
        <p className="text-sm text-muted-foreground">
          {selectedFullName} — configure file patterns, base error thresholds, and observation windows.
        </p>
      </div>

      {error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}
      {saved && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-foreground space-y-3">
          <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            <span>Saved — committed custom threshold rules to {selectedFullName}.</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Your custom path rules and threshold sensitivity curves are now active for upcoming deployments.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              href={`/dashboard/status/${installationId}?repo=${encodeURIComponent(selectedFullName)}`}
              className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
            >
              <Radio className="size-3.5" />
              <span>Go to Live Status</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      )}

      <RulesForm installationId={installationId} owner={owner!} repo={repoName!} initial={toFormInitial(existing)} />
    </main>
  );
}
