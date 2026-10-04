import type { FastifyInstance } from "fastify";
import type { DeployTarget } from "../adapters/github/webhookPayload.js";
import type { FetchFn } from "../adapters/github/fetchTypes.js";
import { listBranchCommits } from "../adapters/github/listBranchCommits.js";
import { verifyDeploymentCi } from "../adapters/github/verifyDeploymentCi.js";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";
import { selectMissingCommits, type ListedCommit } from "../commits/selectMissingCommits.js";
import { prisma as defaultPrisma } from "../db/client.js";
import { EmptyChangeSetError } from "../pipeline.js";

export interface RefreshCommitsPrismaClient extends InstallationAuthPrismaClient {
  commit: {
    findMany(args: {
      where: { installationId: string; owner: string; repo: string; sha: { in: string[] } };
      select: { sha: true };
    }): Promise<Array<{ sha: string }>>;
  };
  rolloutOutcome?: {
    findFirst(args: {
      where: { installationId: string; owner: string; repo: string; commitSha: string };
    }): Promise<{ id: string; status?: string; reason?: string | null; rollbackVerified?: boolean | null; finalErrorRate?: number | null } | null>;
  };
}

export interface ClassifyCommitOptions {
  /** True only for the branch tip: start soak/rollback. Historical SHAs stay classify-only. */
  observeLive?: boolean;
}

export interface RefreshCommitsRouteOptions {
  prismaClient?: RefreshCommitsPrismaClient;
  getInstallationToken: (installationId: string) => Promise<string>;
  classifyCommit: (target: DeployTarget, options?: ClassifyCommitOptions) => Promise<void>;
  listCommits?: (
    owner: string,
    repo: string,
    branch: string,
    token: string,
  ) => Promise<ListedCommit[]>;
  fetchFn?: FetchFn;
}

interface RefreshBody {
  owner?: unknown;
  repo?: unknown;
  branch?: unknown;
  observeLive?: unknown;
  expectedSha?: unknown;
  ciRunId?: unknown;
}

/**
 * POST /v1/commits/refresh — classify branch commits this installation does not
 * have yet. Intermediate SHAs are classify-only. The branch tip starts a live
 * soak only for an explicit exact-SHA deployment request from the CI-gated workflow.
 */
export async function registerRefreshCommitsRoute(app: FastifyInstance, options: RefreshCommitsRouteOptions) {
  const prismaClient = options.prismaClient ?? (defaultPrisma as unknown as RefreshCommitsPrismaClient);
  const listCommits =
    options.listCommits ??
    ((owner: string, repo: string, branch: string, token: string) =>
      listBranchCommits(owner, repo, branch, token, options.fetchFn));

  app.post("/v1/commits/refresh", async (request, reply) => {
    const installationId = await resolveInstallationFromAuthHeader(prismaClient, request.headers.authorization);
    if (!installationId) {
      return reply.code(401).send({ error: "missing or invalid Authorization: Bearer <installation API key> header" });
    }

    const body = (request.body ?? {}) as RefreshBody;
    const owner = typeof body.owner === "string" ? body.owner.trim() : "";
    const repo = typeof body.repo === "string" ? body.repo.trim() : "";
    const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : "main";
    const observeLive = body.observeLive === true;
    const expectedSha = typeof body.expectedSha === "string" ? body.expectedSha.trim().toLowerCase() : "";
    if (!owner || !repo) {
      return reply.code(400).send({ error: "owner and repo are required" });
    }
    if (observeLive && !/^[0-9a-f]{40}$/.test(expectedSha)) {
      return reply.code(400).send({ error: "observeLive requires the exact 40-character expectedSha" });
    }
    if (observeLive && (!Number.isSafeInteger(body.ciRunId) || Number(body.ciRunId) <= 0)) {
      return reply.code(400).send({ error: "observeLive requires a positive ciRunId from the successful CI workflow" });
    }

    let token: string;
    try {
      token = await options.getInstallationToken(installationId);
    } catch (error) {
      return reply.code(502).send({
        error: "failed to mint a GitHub installation token",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (observeLive) {
      try {
        await verifyDeploymentCi({ owner, repo, branch, sha: expectedSha, runId: Number(body.ciRunId), token }, options.fetchFn);
      } catch (error) {
        return reply.code(403).send({ error: error instanceof Error ? error.message : "CI verification failed" });
      }
    }

    let branchCommits: ListedCommit[];
    try {
      branchCommits = await listCommits(owner, repo, branch, token);
    } catch (error) {
      return reply.code(502).send({
        error: "failed to list commits from GitHub",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const knownRows = await prismaClient.commit.findMany({
      where: { installationId, owner, repo, sha: { in: branchCommits.map((commit) => commit.sha) } },
      select: { sha: true },
    });
    const known = new Set(knownRows.map((row) => row.sha));
    const missing = selectMissingCommits(branchCommits, known);

    const pulled: Array<{ sha: string; baseSha: string }> = [];
    const failed: Array<{ sha: string; error: string }> = [];
    const skipped: Array<{ sha: string; reason: string }> = [];
    const tip = branchCommits[0];
    const tipSha = tip?.sha;
    if (observeLive && tipSha?.toLowerCase() !== expectedSha) {
      return reply.code(409).send({ error: "expectedSha is not the current branch tip; deployment skipped" });
    }
    let soakSha: string | null = null;
    // A deployment request acts on one exact revision. History refresh is read-only.
    const commitsToClassify = observeLive ? missing.filter((commit) => commit.sha === tipSha) : missing;
    for (const commit of commitsToClassify) {
      try {
        const watchTip = observeLive && commit.sha === tipSha;
        await options.classifyCommit(
          {
            owner,
            repo,
            baseSha: commit.parentSha,
            headSha: commit.sha,
            installationId,
            event: "push",
          },
          { observeLive: watchTip },
        );
        pulled.push({ sha: commit.sha, baseSha: commit.parentSha });
        if (watchTip) {
          soakSha = commit.sha;
        }
      } catch (error) {
        if (!observeLive && error instanceof EmptyChangeSetError) {
          skipped.push({ sha: commit.sha, reason: "Empty diff; nothing to classify" });
        } else {
          failed.push({ sha: commit.sha, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    if (observeLive && tip?.parentSha && !missing.some((commit) => commit.sha === tip.sha)) {
      let hasRollout = false;
      if (prismaClient.rolloutOutcome?.findFirst) {
        const existing = await prismaClient.rolloutOutcome.findFirst({
          where: { installationId, owner, repo, commitSha: tip.sha },
        });
        hasRollout = Boolean(existing);
      }
      if (!hasRollout) {
        try {
          await options.classifyCommit(
            {
              owner,
              repo,
              baseSha: tip.parentSha,
              headSha: tip.sha,
              installationId,
              event: "push",
            },
            { observeLive: true },
          );
          soakSha = tip.sha;
        } catch (error) {
          failed.push({ sha: tip.sha, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    return reply.code(200).send({
      pulled,
      alreadyKnown: known.size,
      failed,
      soakSha,
      ...(skipped.length ? { skipped } : {}),
    });
  });

  app.get<{ Querystring: { owner?: string; repo?: string; sha?: string } }>("/v1/rollouts/status", async (request, reply) => {
    const installationId = await resolveInstallationFromAuthHeader(prismaClient, request.headers.authorization);
    if (!installationId) return reply.code(401).send({ error: "invalid installation API key" });
    const owner = request.query.owner?.trim() ?? "";
    const repo = request.query.repo?.trim() ?? "";
    const sha = request.query.sha?.trim().toLowerCase() ?? "";
    if (!owner || !repo || !/^[0-9a-f]{40}$/i.test(sha)) return reply.code(400).send({ error: "owner, repo, and full sha are required" });
    const outcome = await prismaClient.rolloutOutcome?.findFirst({ where: { installationId, owner, repo, commitSha: sha } });
    if (!outcome) return reply.code(404).send({ error: "rollout not found" });
    return reply.send({ status: outcome.status ?? "PENDING", reason: outcome.reason ?? null, rollbackVerified: outcome.rollbackVerified ?? null, finalErrorRate: outcome.finalErrorRate ?? null });
  });
}
