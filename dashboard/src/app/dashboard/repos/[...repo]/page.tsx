import { redirect, notFound } from "next/navigation";
import { getCurrentAccount } from "../../../../lib/auth";
import { listInstallationsForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import type { RepoConnection } from "@prisma/client";
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
        try {
          const foundConn = await prisma.repoConnection.findFirst({
            where: { repo: repoName },
          });
          return foundConn ? foundConn.owner : "unknown";
        } catch {
          return "unknown";
        }
      },
      "unknown",
    );
    owner = ownerLookup.value;
  }

  const installationIds = installations.map((i) => String(i.installationId));
  const isSahaay = repoName.toLowerCase() === "sahaay";

  const connectionRead = await readOrEmpty(
    "[dashboard/repos] failed to load repo connection:",
    async () => {
      try {
        return await prisma.repoConnection.findFirst({
          where: {
            installationId: { in: installationIds },
            owner: { equals: owner, mode: "insensitive" },
            repo: { equals: repoName, mode: "insensitive" },
          },
        });
      } catch (err: unknown) {
        if (err && typeof err === "object" && (err as { code?: string }).code === "P2022") {
          // Non-destructive fallback when DB schema has unapplied migration columns
          try {
            const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
              `SELECT * FROM "RepoConnection" WHERE "installationId" = ANY($1::text[]) AND lower("owner") = lower($2) AND lower("repo") = lower($3) LIMIT 1`,
              installationIds,
              owner,
              repoName,
            );
            if (rows && rows.length > 0) {
              const row = rows[0]!;
              const storedCfg = (row.storedConfig ?? {}) as Record<string, unknown>;
              const conn: RepoConnection = {
                id: String(row.id ?? `conn-${owner}-${repoName}`),
                repo: String(row.repo ?? repoName),
                owner: String(row.owner ?? owner),
                installationId: String(row.installationId ?? installationIds[0]),
                mode: (row.mode ?? "standalone") as RepoConnection["mode"],
                verifiedAt: (row.verifiedAt ?? null) as Date | null,
                monitoringPaused: Boolean(row.monitoringPaused),
                storedConfig: (row.storedConfig ?? null) as RepoConnection["storedConfig"],
                installTokenHash: (row.installTokenHash ?? null) as string | null,
                installTokenPrefix: (row.installTokenPrefix ?? null) as string | null,
                agentLastHeartbeat: (row.agentLastHeartbeat ?? null) as Date | null,
                agentRevoked: (row.agentRevoked ?? null) as boolean | null,
                agentVersion: (row.agentVersion ?? null) as string | null,
                verificationReport: (row.verificationReport ?? null) as RepoConnection["verificationReport"],
                deploymentIntegration: (row.deploymentIntegration ?? "github_actions") as string | null,
                runtimeAdapter: (row.runtimeAdapter ?? (row.mode === "standalone" || isSahaay ? "pm2" : "none")) as string | null,
                pm2Process: (row.pm2Process ?? storedCfg.target ?? (isSahaay ? "sahaay" : null)) as string | null,
                createdAt: (row.createdAt ?? new Date()) as Date,
                updatedAt: (row.updatedAt ?? new Date()) as Date,
              };
              return conn;
            }
            return null;
          } catch (fallbackErr) {
            console.error("[dashboard/repos] raw connection query fallback failed:", fallbackErr);
          }
        }
        throw err;
      }
    },
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
    />
  );
}
