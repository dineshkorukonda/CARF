import { redirect } from "next/navigation";
import { InstallationTabs } from "../../../../components/InstallationTabs";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { fetchRecentCommits, type RecentCommit } from "../../../../adapters/coreApi/client";
import { env } from "../../../../config/env";

const RECENT_COMMITS_LIMIT = 20; // matches core-api's src/routes/commits.ts

function typeCounts(commits: RecentCommit[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const commit of commits) {
    for (const type of commit.activeTypes) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
}

export default async function AnalyticsPage({ params }: { params: Promise<{ installationId: string }> }) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const { installationId } = await params;
  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) redirect("/dashboard?error=not_authorized");

  let commits: RecentCommit[] = [];
  let loadError: string | null = null;
  try {
    const apiKey = await ensureCoreApiKey(prisma, installation);
    commits = await fetchRecentCommits(env.coreApiBaseUrl(), apiKey);
  } catch {
    loadError = "Couldn't reach core-api for this installation's data yet.";
  }

  const rolledBack = commits.filter((c) => c.rolledBack === true).length;
  const healthy = commits.filter((c) => c.rolledBack === false).length;
  const byType = typeCounts(commits);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">{installation.targetLogin}</h1>
        <p className="text-sm text-muted-foreground">
          Based on the last {RECENT_COMMITS_LIMIT} commits CARF has classified.
        </p>
      </div>

      <InstallationTabs installationId={installationId} active="analytics" />

      {loadError ? (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">{loadError}</p>
      ) : commits.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">
          No classified commits yet -- analytics will show up here once CARF has seen some activity.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px border border-border bg-border">
            <div className="bg-background px-6 py-5">
              <div className="font-mono text-3xl font-medium">{String(commits.length).padStart(2, "0")}</div>
              <div className="mt-1.5 text-xs text-muted-foreground">Classified commits</div>
            </div>
            <div className="bg-background px-6 py-5">
              <div className="font-mono text-3xl font-medium">{String(healthy).padStart(2, "0")}</div>
              <div className="mt-1.5 text-xs text-muted-foreground">Healthy</div>
            </div>
            <div className="bg-background px-6 py-5">
              <div className="font-mono text-3xl font-medium">{String(rolledBack).padStart(2, "0")}</div>
              <div className="mt-1.5 text-xs text-muted-foreground">Rolled back</div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">By classification type</p>
            <div className="mt-3 flex flex-col divide-y divide-border border-t border-border">
              {byType.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  None of these commits matched a classification rule.
                </p>
              ) : (
                byType.map(({ type, count }) => (
                  <div key={type} className="flex items-center justify-between py-2.5">
                    <span className="text-sm">{type}</span>
                    <span className="font-mono text-sm text-muted-foreground">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
