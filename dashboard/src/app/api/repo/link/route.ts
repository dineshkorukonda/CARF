import { NextRequest, NextResponse } from "next/server";
import { load } from "js-yaml";
import { env } from "../../../../config/env";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { signGithubAppJwt } from "../../../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../../../adapters/github/installationTokenClient";
import {
  getCarfConfigFile,
  putCarfConfigFile,
  GitHubContentsError,
} from "../../../../adapters/github/contentsClient";
import { applyModeAdapterPatch, carfConfigsEqual } from "../../../../lib/carfConfigWriter";
import {
  AdapterConfigSchema,
  type AdapterKind,
} from "../../../../lib/carfConfigSchema";
import { generateInstallToken } from "../../../../lib/agentToken";
import { resolveRepoMode, type DeploymentMode } from "../../../../lib/deploymentMode";
import { resolveFromLegacy } from "../../../../lib/capabilities";

export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let installationId = "";
  let owner = "";
  let repo = "";
  let mode = "";
  let deploymentIntegration: string | undefined;
  let runtimeAdapter: string | undefined;
  let adapterKind = "";
  let adapterTarget = "";
  let integration = "";
  let adapterExtras: Record<string, unknown> = {};

  try {
    const body = (await request.json()) as Record<string, unknown>;
    installationId = String(body.installationId ?? "");
    owner = String(body.owner ?? "");
    repo = String(body.repo ?? "");
    mode = typeof body.mode === "string" ? body.mode : "";
    deploymentIntegration = typeof body.deploymentIntegration === "string" ? body.deploymentIntegration : undefined;
    runtimeAdapter = typeof body.runtimeAdapter === "string" ? body.runtimeAdapter : undefined;
    adapterKind = String(body.adapterKind ?? (body.runtimeAdapter === "pm2" ? "pm2" : ""));
    adapterTarget = String(body.adapterTarget ?? "");
    integration = String(body.integration ?? "github-actions");

    adapterExtras = {
      ...(typeof body.layout === "string" ? { layout: body.layout } : {}),
      ...(typeof body.adapterLayout === "string" ? { layout: body.adapterLayout } : {}),
      ...(typeof body.cwd === "string" ? { cwd: body.cwd } : {}),
      ...(typeof body.releasesDir === "string" ? { releasesRoot: body.releasesDir } : {}),
      ...(typeof body.releasesRoot === "string" ? { releasesRoot: body.releasesRoot } : {}),
      ...(typeof body.currentSymlink === "string" ? { currentSymlink: body.currentSymlink } : {}),
      ...(typeof body.healthUrl === "string" ? { healthUrl: body.healthUrl } : {}),
      ...(Array.isArray(body.sharedDirs)
        ? { sharedPaths: body.sharedDirs.map(String) }
        : {}),
      ...(Array.isArray(body.sharedPaths) ? { sharedPaths: body.sharedPaths.map(String) } : {}),
      ...(typeof body.buildCommand === "string" ? { buildCommand: body.buildCommand } : {}),
      ...(typeof body.probeCount === "number" ? { probeCount: body.probeCount } : {}),
      ...(typeof body.startupGraceSeconds === "number"
        ? { startupGraceSeconds: body.startupGraceSeconds }
        : {}),
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!installationId || !owner || !repo || (!mode && !deploymentIntegration && !runtimeAdapter)) {
    return NextResponse.json(
      { error: "Missing required fields: installationId, owner, repo, and configuration" },
      { status: 400 }
    );
  }

  if (mode && mode !== "standalone" && mode !== "augment") {
    return NextResponse.json(
      { error: "mode must be explicitly 'standalone' or 'augment'" },
      { status: 400 }
    );
  }

  const resolved = resolveFromLegacy({
    mode: mode || undefined,
    deploymentIntegration,
    runtimeAdapter,
    adapter: adapterKind ? { kind: adapterKind } : undefined,
    repo,
  });

  const deploymentMode: DeploymentMode = resolveRepoMode({ mode: resolved.capabilities.rollback ? "standalone" : "augment" });

  if (deploymentMode === "standalone" || resolved.capabilities.rollback) {
    adapterKind = adapterKind || (resolved.runtimeAdapter === "pm2" ? "pm2" : "pm2");
    if (!adapterTarget) {
      return NextResponse.json(
        { error: "adapterKind and adapterTarget are required for standalone mode" },
        { status: 400 }
      );
    }
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 403 });
  }

  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const { token } = await createInstallationToken(installationId, appJwt);

    const existingFile = await getCarfConfigFile(owner, repo, token);

    const adapterConfig =
      deploymentMode === "standalone" && adapterKind === "pm2"
        ? AdapterConfigSchema.parse({
            kind: adapterKind as AdapterKind,
            target: adapterTarget,
            ...adapterExtras,
          })
        : undefined;

    const nextYaml = applyModeAdapterPatch(existingFile?.content ?? null, {
      mode: deploymentMode,
      deploymentIntegration: resolved.deploymentIntegration,
      runtimeAdapter: resolved.runtimeAdapter,
      adapter: adapterConfig,
    });

    if (!carfConfigsEqual(existingFile?.content ?? null, nextYaml)) await putCarfConfigFile(
      owner,
      repo,
      nextYaml,
      "chore(carf): link repository — add .carf.yml configuration",
      token,
      existingFile?.sha
    );

    if (deploymentMode === "augment") {
      const storedConfig = {
        mode: "augment" as const,
        deploymentIntegration: resolved.deploymentIntegration,
        runtimeAdapter: resolved.runtimeAdapter,
        integration,
      };

      try {
        await prisma.repoConnection.upsert({
          where: {
            installationId_owner_repo: {
              installationId,
              owner,
              repo,
            },
          },
          create: {
            installationId,
            owner,
            repo,
            mode: "augment",
            deploymentIntegration: resolved.deploymentIntegration,
            runtimeAdapter: resolved.runtimeAdapter,
            pm2Process: null,
            storedConfig,
            verifiedAt: null,
            installTokenHash: null,
            installTokenPrefix: null,
            agentRevoked: false,
          },
          update: {
            mode: "augment",
            deploymentIntegration: resolved.deploymentIntegration,
            runtimeAdapter: resolved.runtimeAdapter,
            pm2Process: null,
            storedConfig,
            verifiedAt: null,
            installTokenHash: null,
            installTokenPrefix: null,
            agentRevoked: false,
          },
        });
      } catch (dbErr) {
        console.error("[api/repo/link] Failed to persist RepoConnection for augment:", dbErr);
      }

      return NextResponse.json({
        success: true,
        mode: "augment",
        deploymentIntegration: resolved.deploymentIntegration,
        runtimeAdapter: resolved.runtimeAdapter,
        capabilities: resolved.capabilities,
        integration,
        owner,
        repo,
      });
    }

    const pm2Process = adapterTarget || null;
    const storedConfig = {
      mode: "standalone" as const,
      ...AdapterConfigSchema.parse((load(nextYaml) as Record<string, unknown>).adapter),
      deploymentIntegration: resolved.deploymentIntegration,
      runtimeAdapter: resolved.runtimeAdapter,
    };
    const { token: installToken, hash: installTokenHash, prefix: installTokenPrefix } = generateInstallToken();

    try {
      await prisma.repoConnection.upsert({
        where: {
          installationId_owner_repo: {
            installationId,
            owner,
            repo,
          },
        },
        create: {
          installationId,
          owner,
          repo,
          mode: "standalone",
          deploymentIntegration: resolved.deploymentIntegration,
          runtimeAdapter: resolved.runtimeAdapter,
          pm2Process,
          storedConfig,
          verifiedAt: null,
          installTokenHash,
          installTokenPrefix,
          agentRevoked: false,
        },
        update: {
          mode: "standalone",
          deploymentIntegration: resolved.deploymentIntegration,
          runtimeAdapter: resolved.runtimeAdapter,
          pm2Process,
          storedConfig,
          verifiedAt: null,
          installTokenHash,
          installTokenPrefix,
          agentRevoked: false,
        },
      });
    } catch (dbErr) {
      console.error("[api/repo/link] Failed to persist RepoConnection after commit:", dbErr);
    }

    return NextResponse.json({
      success: true,
      mode: "standalone",
      deploymentIntegration: resolved.deploymentIntegration,
      runtimeAdapter: resolved.runtimeAdapter,
      capabilities: resolved.capabilities,
      owner,
      repo,
      adapterKind,
      adapterTarget,
      pm2Process,
      installToken,
      installTokenPrefix,
    });
  } catch (error: unknown) {
    console.error("[api/repo/link] Failed to link repository:", error);
    if (error instanceof GitHubContentsError) {
      return NextResponse.json({ error: error.message, reason: error.reason }, { status: error.status || 502 });
    }
    return NextResponse.json({ error: "Failed to commit .carf.yml to GitHub repository" }, { status: 502 });
  }
}
