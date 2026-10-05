import { redirect, notFound } from "next/navigation";
import { getCurrentAccount } from "../../../../lib/auth";
import { listInstallationsForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { readOrEmpty } from "../../../../lib/repoActivity";
import { findRepoConnectionSafe } from "../../../../lib/repoConnectionService";
import { PROJECT_SECTIONS, type ProjectSection } from "../../../../lib/dashboardNav";
import {
  RepoDetailView,
  type RolloutItem,
  type CommitWithDetails,
  type AuditLogItem,
} from "./RepoDetailView";

export default async function RepoDetailPage(props: {
  params: Promise<{ repo: string[] }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const { repo: repoParts } = await props.params;
  const { view: requestedView } = await props.searchParams;
  const view: ProjectSection = PROJECT_SECTIONS.includes(requestedView as ProjectSection)
    ? requestedView as ProjectSection
    : "overview";
  if (!repoParts || repoParts.length === 0) {
    notFound();
  }

  const installations = await listInstallationsForAccount(prisma, account.id);
  if (installations.length === 0) {
    redirect("/dashboard/settings");
  }

  // Canonical format: /dashboard/repos/[owner]/[repo]
  // Fallback for single-segment paths: infer owner from GitHub App installation
  let owner: string;
  let repoName: string;

  if (repoParts.length >= 2) {
    owner = repoParts[0]!;
    repoName = repoParts.slice(1).join("/");
  } else {
    repoName = repoParts[0]!;
    const ownerLookup = await readOrEmpty(
      "[dashboard/repos] failed to resolve repo owner:",
      async () => {
        try {
          const inst = installations[0]!;
          return inst.targetLogin;
        } catch {
          return "unknown";
        }
      },
      "unknown",
    );
    owner = ownerLookup.value;
  }

  const installationIds = installations.map((i) => String(i.installationId));

  const [connectionRead, rolloutsRead, commitsRead, auditRead] = await Promise.all([
    readOrEmpty(
      "[dashboard/repos] failed to load repo connection:",
      () => findRepoConnectionSafe(installationIds, owner, repoName),
      null,
    ),
    readOrEmpty(
      "[dashboard/repos] failed to load rollouts:",
      () =>
        prisma.rolloutOutcome.findMany({
          where: {
            installationId: { in: installationIds },
            owner: { equals: owner, mode: "insensitive" },
            repo: { equals: repoName, mode: "insensitive" },
          },
          orderBy: {
            startedAt: "desc",
          },
          take: 50,
        }),
      [],
    ),
    readOrEmpty(
      "[dashboard/repos] failed to load commits:",
      () =>
        prisma.commit.findMany({
          where: {
            installationId: { in: installationIds },
            owner: { equals: owner, mode: "insensitive" },
            repo: { equals: repoName, mode: "insensitive" },
          },
          include: {
            changeVector: true,
            threshold: true,
            riskProfile: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        }),
      [],
    ),
    readOrEmpty(
      "[dashboard/repos] failed to load audit logs:",
      () =>
        prisma.rolloutAuditLog.findMany({
          where: {
            owner: { equals: owner, mode: "insensitive" },
            repo: { equals: repoName, mode: "insensitive" },
          },
          orderBy: {
            ts: "desc",
          },
          take: 50,
        }),
      [],
    ),
  ]);

  const connection = connectionRead.value;
  const rollouts = rolloutsRead.value;
  const commits = commitsRead.value;
  const auditLogs = auditRead.value;

  // Crucial: connection schema errors must not suppress rollout history display!
  const activityError = rolloutsRead.error || commitsRead.error || auditRead.error;

  return (
    <RepoDetailView
      owner={owner}
      repo={repoName}
      defaultBranch="main"
      installationId={connection?.installationId || installations[0]!.installationId}
      connection={connection}
      rollouts={rollouts as unknown as RolloutItem[]}
      commits={commits as unknown as CommitWithDetails[]}
      auditLogs={auditLogs as unknown as AuditLogItem[]}
      activityError={activityError}
      view={view}
    />
  );
}
