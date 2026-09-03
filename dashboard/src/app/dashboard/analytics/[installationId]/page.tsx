import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { fetchRecentCommits, type RecentCommit } from "../../../../adapters/coreApi/client";
import { env } from "../../../../config/env";
import { RepoNavigationTabs } from "../../RepoNavigationTabs";

const RECENT_COMMITS_LIMIT = 20; // matches core-api's src/routes/commits.ts

const TYPE_COLORS: Record<string, { bg: string; badge: string }> = {
  infra: { bg: "bg-rose-500", badge: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  dependency: { bg: "bg-purple-500", badge: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
  config: { bg: "bg-amber-500", badge: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  code: { bg: "bg-blue-500", badge: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  data: { bg: "bg-teal-500", badge: "text-teal-500 bg-teal-500/10 border-teal-500/20" },
};

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
  let apiKey: string | null = null;
  try {
    apiKey = await ensureCoreApiKey(prisma, installation);
    commits = await fetchRecentCommits(env.coreApiBaseUrl(), apiKey);
  } catch {
    loadError = "Couldn't reach core-api for this installation's data yet.";
  }

  const rolledBack = commits.filter((c) => c.rolledBack === true).length;
  const healthy = commits.filter((c) => c.rolledBack === false).length;
  const evaluatedCount = healthy + rolledBack;
  const stabilityRate = evaluatedCount > 0 ? Math.round((healthy / evaluatedCount) * 100) : null;

  const byType = typeCounts(commits);
  const totalTypeHits = byType.reduce((sum, item) => sum + item.count, 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8">
      <RepoNavigationTabs
        installationId={installationId}
        repoName={installation.targetLogin}
        apiKey={apiKey}
      />

      <div>
        <h1 className="text-xl font-semibold">Rollout Health & Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Stability metrics and risk distribution based on the last {RECENT_COMMITS_LIMIT} classified commits.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">{loadError}</p>
      ) : commits.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">
          No classified commits yet -- analytics will show up here once CARF has seen some activity.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-4">
            <div className="bg-background px-6 py-5">
              <div className="font-mono text-3xl font-medium">{String(commits.length).padStart(2, "0")}</div>
              <div className="mt-1.5 text-xs text-muted-foreground">Classified commits</div>
            </div>
            <div className="bg-background px-6 py-5">
              <div className="font-mono text-3xl font-medium text-emerald-600 dark:text-emerald-400">
                {String(healthy).padStart(2, "0")}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">Healthy deployments</div>
            </div>
            <div className="bg-background px-6 py-5">
              <div className="font-mono text-3xl font-medium text-destructive">
                {String(rolledBack).padStart(2, "0")}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">Automated rollbacks</div>
            </div>
            <div className="bg-background px-6 py-5">
              <div className="font-mono text-3xl font-medium">
                {stabilityRate !== null ? `${stabilityRate}%` : "--"}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">Stability rate</div>
            </div>
          </div>

          {/* Rollout Stability Visual Ratio */}
          {evaluatedCount > 0 && (
            <div className="rounded-sm border border-border p-5 bg-card flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Rollout Outcomes Ratio
                </span>
                <span className="font-mono text-muted-foreground">
                  {healthy} healthy · {rolledBack} rolled back
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                <div
                  style={{ width: `${(healthy / evaluatedCount) * 100}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Healthy: ${healthy}`}
                />
                <div
                  style={{ width: `${(rolledBack / evaluatedCount) * 100}%` }}
                  className="bg-destructive h-full transition-all"
                  title={`Rolled back: ${rolledBack}`}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-emerald-500" />
                  <span>Healthy ({((healthy / evaluatedCount) * 100).toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-destructive" />
                  <span>Rolled Back ({((rolledBack / evaluatedCount) * 100).toFixed(0)}%)</span>
                </div>
              </div>
            </div>
          )}

          {/* Change Type Distribution */}
          <div className="rounded-sm border border-border p-5 bg-card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Change Type Distribution
              </p>
              <span className="text-xs font-mono text-muted-foreground">
                {totalTypeHits} total type assignments
              </span>
            </div>

            {totalTypeHits > 0 && (
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                {byType.map(({ type, count }) => {
                  const color = TYPE_COLORS[type]?.bg ?? "bg-zinc-400";
                  const pct = (count / totalTypeHits) * 100;
                  return (
                    <div
                      key={type}
                      style={{ width: `${pct}%` }}
                      className={`${color} h-full transition-all`}
                      title={`${type}: ${count} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
            )}

            <div className="flex flex-col divide-y divide-border border-t border-border pt-1">
              {byType.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  None of these commits matched a classification rule.
                </p>
              ) : (
                byType.map(({ type, count }) => {
                  const colorInfo = TYPE_COLORS[type] ?? {
                    bg: "bg-zinc-400",
                    badge: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
                  };
                  const pct = totalTypeHits > 0 ? ((count / totalTypeHits) * 100).toFixed(1) : "0";
                  return (
                    <div key={type} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${colorInfo.bg}`} />
                        <span className="text-sm font-medium capitalize">{type}</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                        <span>{pct}%</span>
                        <span className="font-semibold text-foreground">({count})</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
