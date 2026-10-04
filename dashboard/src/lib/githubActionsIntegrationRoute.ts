import { NextResponse } from "next/server";
import { env } from "../config/env";
import { signGithubAppJwt } from "../adapters/github/appInstallClient";
import * as githubClient from "../adapters/github/repoContentsClient";
import { refreshRepoCommits } from "../adapters/coreApi/client";
import { getCurrentAccount } from "./auth";
import { getInstallationForAccount } from "./accountService";
import { ensureCoreApiKey } from "./coreApiAccess";
import { mintInstallationToken } from "./installationAccess";
import { prisma } from "./prisma";
import { attemptAutoRepairSchema } from "./repoConnectionService";
import {
  GitHubActionsIntegrationService,
  IntegrationError,
  createPrismaIntegrationStore,
  type IntegrationContext,
  type RepoIntegrationPrismaClient,
} from "./githubActionsIntegrationService";

export type IntegrationAction = "install" | "verify" | "reconfigure" | "disable" | "status";

/**
 * Shared handler behind every `/api/repositories/[repositoryId]/integrations/github-actions*`
 * route: authenticates the dashboard session, proves the caller owns the repository's GitHub
 * App installation, then delegates to GitHubActionsIntegrationService. Responses contain only
 * safe metadata -- tokens, API keys and secret values never reach this layer's output.
 */
export async function handleGithubActionsIntegration(repositoryId: string, action: IntegrationAction): Promise<NextResponse> {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await attemptAutoRepairSchema();

  const connection = await prisma.repoConnection.findUnique({ where: { id: repositoryId } });
  if (!connection) return NextResponse.json({ error: "Repository not found" }, { status: 404 });

  const installation = await getInstallationForAccount(prisma, account.id, connection.installationId);
  if (!installation) return NextResponse.json({ error: "Repository not found" }, { status: 404 });

  const ctx: IntegrationContext = {
    installationId: connection.installationId,
    owner: connection.owner,
    repo: connection.repo,
    connection,
  };

  const service = new GitHubActionsIntegrationService({
    store: createPrismaIntegrationStore(prisma as unknown as RepoIntegrationPrismaClient, attemptAutoRepairSchema),
    github: githubClient,
    mintInstallationToken,
    signAppJwt: () => signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey()),
    getApiKey: () => ensureCoreApiKey(prisma, installation),
    coreApiUrl: env.coreApiPublicUrl(),
    probePolicy: async ({ owner, repo, sha, apiKey }) => {
      const url = new URL(`${env.coreApiBaseUrl()}/v1/augment/threshold`);
      url.searchParams.set("owner", owner);
      url.searchParams.set("repo", repo);
      url.searchParams.set("sha", sha);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      const body = res.ok ? ((await res.json()) as { threshold?: number; window?: number; changeVector?: Record<string, number> }) : undefined;
      return { status: res.status, ...(body ? { body } : {}) };
    },
    refreshCommits: async ({ owner, repo, branch, apiKey }) => {
        await refreshRepoCommits(env.coreApiBaseUrl(), apiKey, { owner, repo, branch, observeLive: false });
    },
    probePublicPolicy: async ({ owner, repo, sha, apiKey }) => {
      const url = new URL(`${env.coreApiPublicUrl()}/v1/augment/threshold`);
      url.searchParams.set("owner", owner);
      url.searchParams.set("repo", repo);
      url.searchParams.set("sha", sha);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      return { status: res.status };
    },
    // Detail is logged server-side only; callers never see it. Authorization headers are never passed here.
    logError: (message, detail) => console.error(message, detail),
  });

  try {
    switch (action) {
      case "install":
        return NextResponse.json(await service.install(ctx));
      case "reconfigure":
        return NextResponse.json(await service.reconfigure(ctx));
      case "verify":
        return NextResponse.json(await service.verify(ctx));
      case "disable":
        return NextResponse.json(await service.disable(ctx));
      case "status": {
        const status = await service.getStatus(ctx);
        return NextResponse.json({ ...status, manualWorkflow: await service.manualWorkflow(ctx) });
      }
    }
  } catch (error) {
    if (error instanceof IntegrationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error("[github-actions-integration] unhandled error", error);
    const detail = error instanceof Error ? error.message : "The integration request failed.";
    return NextResponse.json({ error: `The integration request failed: ${detail}` }, { status: 500 });
  }
}
