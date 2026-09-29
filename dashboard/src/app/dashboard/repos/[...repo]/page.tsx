import { redirect, notFound } from "next/navigation";
import { getCurrentAccount } from "../../../../lib/auth";
import { listInstallationsForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { readOrEmpty } from "../../../../lib/repoActivity";
import {
  RepoDetailView,
  type RolloutItem,
  type CommitWithDetails,
  type AuditLogItem,
} from "./RepoDetailView";

export default async function RepoDetailPage(props: {
  params: Promise<{ repo: string[] }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const { repo: repoParts } = await props.params;
  if (!repoParts || repoParts.length === 0) {
    notFound();
  }

  const installations = await listInstallationsForAccount(prisma, account.id);
  if (installations.length === 0) {
    redirect("/dashboard/settings");
  }

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
        const foundCommit = await prisma.commit.findFirst({
          where: { repo: repoName },
        });
        if (foundCommit) return foundCommit.owner;
        const foundConn = await prisma.repoConnection.findFirst({
          where: { repo: repoName },
        });
        return foundConn ? foundConn.owner : "unknown";
      },
      "unknown",
    );
    owner = ownerLookup.value;
  }

  const installationIds = installations.map((i) => String(i.installationId));

  const connectionRead = await readOrEmpty(
    "[dashboard/repos] failed to load repo connection:",
    () =>
      prisma.repoConnection.findFirst({
        where: {
          installationId: { in: installationIds },
          owner: { equals: owner, mode: "insensitive" },
          repo: { equals: repoName, mode: "insensitive" },
        },
      }),
    null,
  );
  const rolloutsRead = await readOrEmpty(
    "[dashboard/repos] failed to load rollouts:",
    () =>
      prisma.rolloutOutcome.findMany({
        where: {
          installationId: { in: installationIds },
          owner: { equals: owner, mode: "insensitive" },
          repo: { equals: repoName, mode: "insensitive" },
        },
        include: {
          samples: {
            orderBy: { ts: "asc" },
          },
        },
        orderBy: {
          startedAt: "desc",
        },
        take: 100,
      }),
    [],
  );
  const commitsRead = await readOrEmpty(
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
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      }),
    [],
  );
  const auditRead = await readOrEmpty(
    "[dashboard/repos] failed to load rollout activity:",
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
  );

  const connection = connectionRead.value;
  const rollouts = rolloutsRead.value;
  const commits = commitsRead.value;
  const auditLogs = auditRead.value;
  const activityError =
    connectionRead.error || rolloutsRead.error || commitsRead.error || auditRead.error;

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
    />
  );
}
