import { notFound, redirect } from "next/navigation";
import { getCurrentAccount } from "../../../../../../lib/auth";
import { listInstallationsForAccount } from "../../../../../../lib/accountService";
import { prisma } from "../../../../../../lib/prisma";
import { mintInstallationToken } from "../../../../../../lib/installationAccess";
import { getCommitMetadata, listCompareFiles, type CompareFile } from "../../../../../../adapters/github/compareClient";
import { pickInstallationIdForCommit } from "../../../../../../lib/commitPageAccess";
import { CommitPipelineView } from "../../../CommitPipelineView";

export default async function CommitPipelinePage(props: {
  params: Promise<{ owner: string; repo: string; sha: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const raw = await props.params;
  const owner = decodeURIComponent(raw.owner);
  const repo = decodeURIComponent(raw.repo);
  const shaParam = decodeURIComponent(raw.sha).trim();
  if (!owner || !repo || shaParam.length < 7) {
    notFound();
  }

  const installations = await listInstallationsForAccount(prisma, account.id);
  if (installations.length === 0) {
    redirect("/dashboard/settings");
  }
  const ownedInstallationIds = installations.map((i) => i.installationId);

  const commit = await prisma.commit.findFirst({
    where: {
      owner: { equals: owner, mode: "insensitive" },
      repo: { equals: repo, mode: "insensitive" },
      OR: [{ sha: shaParam }, { sha: { startsWith: shaParam.toLowerCase() } }],
    },
    include: {
      changeVector: true,
      threshold: true,
      rolloutOutcomes: {
        include: { samples: { orderBy: { ts: "asc" } } },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!commit) {
    notFound();
  }

  const connection = await prisma.repoConnection.findFirst({
    where: {
      installationId: { in: ownedInstallationIds },
      owner: { equals: commit.owner, mode: "insensitive" },
      repo: { equals: commit.repo, mode: "insensitive" },
    },
  });

  const installationId = pickInstallationIdForCommit({
    commitInstallationId: commit.installationId,
    ownedInstallationIds,
    connectionInstallationId: connection?.installationId ?? null,
  });
  if (!installationId) {
    notFound();
  }

  let files: CompareFile[] = [];
  let filesError: string | null = null;
  let metadata: { message: string; author: string } | null = null;
  try {
    const token = await mintInstallationToken(installationId);
    const [fileResult, metadataResult] = await Promise.allSettled([
      listCompareFiles(commit.owner, commit.repo, commit.baseSha, commit.sha, token),
      getCommitMetadata(commit.owner, commit.repo, commit.sha, token),
    ]);
    if (metadataResult.status === "fulfilled") metadata = metadataResult.value;
    if (fileResult.status === "fulfilled") files = fileResult.value;
    else throw fileResult.reason;
  } catch (err) {
    filesError =
      err instanceof Error
        ? `Could not load changed files from GitHub: ${err.message}`
        : "Could not load changed files from GitHub.";
  }

  const cv = commit.changeVector;
  const th = commit.threshold;
  const rollout = commit.rolloutOutcomes[0] ?? null;

  return (
    <CommitPipelineView
      owner={commit.owner}
      repo={commit.repo}
      sha={commit.sha}
      baseSha={commit.baseSha}
      createdAt={commit.createdAt}
      message={metadata?.message ?? null}
      author={metadata?.author ?? null}
      vector={
        cv
          ? {
              infra: cv.infra,
              dependency: cv.dependency,
              config: cv.config,
              code: cv.code,
              data: cv.data,
              codeComplexity: cv.codeComplexity,
            }
          : null
      }
      threshold={
        th
          ? {
              finalThreshold: th.finalThreshold,
              finalWindow: th.finalWindow,
              activeTypes: th.activeTypes,
            }
          : null
      }
      rollout={
        rollout
          ? {
              status: rollout.status,
              reason: rollout.reason,
              rolledBack: rollout.rolledBack,
              rollbackVerified: rollout.rollbackVerified,
              threshold: rollout.threshold,
              startedAt: rollout.startedAt,
              finishedAt: rollout.finishedAt,
              samples: rollout.samples.map((s) => ({ ts: s.ts, errorRate: s.errorRate })),
            }
          : null
      }
      files={files}
      filesError={filesError}
    />
  );
}
