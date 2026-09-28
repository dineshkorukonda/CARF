import { redirect, notFound } from "next/navigation";
import { getCurrentAccount } from "../../../../lib/auth";
import { listInstallationsForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { RepoDetailView } from "./RepoDetailView";

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
    // Attempt to lookup owner from Commit or RepoConnection
    const foundCommit = await prisma.commit.findFirst({
      where: { repo: repoName },
    });
    if (foundCommit) {
      owner = foundCommit.owner;
    } else {
      const foundConn = await prisma.repoConnection.findFirst({
        where: { repo: repoName },
      });
      owner = foundConn ? foundConn.owner : "unknown";
    }
  }

  const installationIds = installations.map((i) => String(i.installationId));

  // Query RepoConnection
  const connection = await prisma.repoConnection.findFirst({
    where: {
      installationId: { in: installationIds },
      owner: { equals: owner, mode: "insensitive" },
      repo: { equals: repoName, mode: "insensitive" },
    },
  });

  // Query Rollouts with Samples
  const rollouts = await prisma.rolloutOutcome.findMany({
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
  });

  // Query Commits with ChangeVector and Threshold
  const commits = await prisma.commit.findMany({
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
  });

  // Query Audit Logs
  const auditLogs = await prisma.rolloutAuditLog.findMany({
    where: {
      owner: { equals: owner, mode: "insensitive" },
      repo: { equals: repoName, mode: "insensitive" },
    },
    orderBy: {
      ts: "desc",
    },
    take: 50,
  });

  return (
    <RepoDetailView
      owner={owner}
      repo={repoName}
      defaultBranch="main"
      installationId={connection?.installationId || installations[0]!.installationId}
      connection={connection}
      rollouts={rollouts as any}
      commits={commits as any}
      auditLogs={auditLogs as any}
    />
  );
}
