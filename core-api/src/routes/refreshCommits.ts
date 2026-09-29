import type { FastifyInstance } from "fastify";
import type { DeployTarget } from "../adapters/github/webhookPayload.js";
import type { FetchFn } from "../adapters/github/fetchTypes.js";
import { listBranchCommits } from "../adapters/github/listBranchCommits.js";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";
import { selectMissingCommits, type ListedCommit } from "../commits/selectMissingCommits.js";
import { prisma as defaultPrisma } from "../db/client.js";

export interface RefreshCommitsPrismaClient extends InstallationAuthPrismaClient {
  commit: {
    findMany(args: {
      where: { installationId: string; owner: string; repo: string; sha: { in: string[] } };
      select: { sha: true };
    }): Promise<Array<{ sha: string }>>;
  };
}

export interface RefreshCommitsRouteOptions {
  prismaClient?: RefreshCommitsPrismaClient;
  getInstallationToken: (installationId: string) => Promise<string>;
  /** Classify one commit. Callers must not start a live rollback watch. */
  classifyCommit: (target: DeployTarget) => Promise<void>;
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
}

/**
 * POST /v1/commits/refresh — classify branch commits this installation does not
 * have yet. A GitHub push webhook only carries the branch tip (`after`), so
 * intermediate SHAs in one push never get a row. This backfills them. It does
 * not start the standalone soak: those SHAs are not what PM2 is running.
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
    if (!owner || !repo) {
      return reply.code(400).send({ error: "owner and repo are required" });
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
    for (const commit of missing) {
      try {
        await options.classifyCommit({
          owner,
          repo,
          baseSha: commit.parentSha,
          headSha: commit.sha,
          installationId,
          event: "push",
        });
        pulled.push({ sha: commit.sha, baseSha: commit.parentSha });
      } catch (error) {
        failed.push({ sha: commit.sha, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return reply.code(200).send({
      pulled,
      alreadyKnown: known.size,
      failed,
    });
  });
}
