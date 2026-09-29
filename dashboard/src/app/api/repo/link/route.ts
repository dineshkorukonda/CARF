import { NextRequest, NextResponse } from "next/server";
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
import { applyModeAdapterPatch } from "../../../../lib/carfConfigWriter";
import { AdapterConfigSchema, type AdapterConfig, type AdapterKind } from "../../../../lib/carfConfigSchema";
import { env } from "../../../../config/env";

/**
 * POST /api/repo/link
 *
 * Links a repository to CARF by committing a `.carf.yml` with the chosen
 * mode + adapter. Accepts JSON (unlike /api/config/save which is a form POST
 * and redirects) so the status page's inline wizard can consume the response
 * without a navigation.
 *
 * Body: { installationId, owner, repo, mode, adapterKind?, adapterTarget?, layout?, healthUrl?, cwd?, ... }
 * Response: { success: true, mode, adapterKind?, adapterTarget? }
 */
export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let installationId = "";
  let owner = "";
  let repo = "";
  let mode = "";
  let adapterKind = "";
  let adapterTarget = "";
  let adapterExtras: Partial<AdapterConfig> = {};

  try {
    const body = (await request.json()) as Record<string, unknown>;
    installationId = String(body.installationId ?? "");
    owner = String(body.owner ?? "");
    repo = String(body.repo ?? "");
    mode = String(body.mode ?? "");
    adapterKind = String(body.adapterKind ?? "");
    adapterTarget = String(body.adapterTarget ?? "");
    adapterExtras = {
      ...(body.layout === "releases" || body.layout === "git" ? { layout: body.layout } : {}),
      ...(typeof body.healthUrl === "string" && body.healthUrl ? { healthUrl: body.healthUrl } : {}),
      ...(typeof body.cwd === "string" && body.cwd ? { cwd: body.cwd } : {}),
      ...(typeof body.releasesRoot === "string" && body.releasesRoot ? { releasesRoot: body.releasesRoot } : {}),
      ...(typeof body.currentSymlink === "string" && body.currentSymlink
        ? { currentSymlink: body.currentSymlink }
        : {}),
      ...(Array.isArray(body.sharedPaths)
        ? { sharedPaths: body.sharedPaths.filter((p): p is string => typeof p === "string" && p.length > 0) }
        : {}),
      ...(typeof body.startupGraceSeconds === "number"
        ? { startupGraceSeconds: body.startupGraceSeconds }
        : {}),
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!installationId || !owner || !repo || !mode) {
    return NextResponse.json(
      { error: "Missing required fields: installationId, owner, repo, mode" },
      { status: 400 }
    );
  }

  if (mode === "standalone" && (!adapterKind || !adapterTarget)) {
    return NextResponse.json(
      { error: "adapterKind and adapterTarget are required for standalone mode" },
      { status: 400 }
    );
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 403 });
  }

  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const { token } = await createInstallationToken(installationId, appJwt);

    const existingFile = await getCarfConfigFile(owner, repo, token).catch(() => null);

    const adapterConfig =
      mode === "standalone"
        ? AdapterConfigSchema.parse({
            kind: adapterKind as AdapterKind,
            target: adapterTarget,
            ...adapterExtras,
          })
        : undefined;

    const nextYaml = applyModeAdapterPatch(existingFile?.content ?? null, {
      mode: mode === "standalone" ? "standalone" : "augment",
      adapter: adapterConfig,
    });

    await putCarfConfigFile(
      owner,
      repo,
      nextYaml,
      "chore(carf): link repository — add .carf.yml with fault-tolerant adapter config",
      token,
      existingFile?.sha
    );

    const storedConfig = adapterConfig ?? { mode: "augment" };

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
          storedConfig,
          verifiedAt: null,
        },
        update: {
          storedConfig,
        },
      });
    } catch (dbErr) {
      console.error("[api/repo/link] Failed to persist RepoConnection after commit:", dbErr);
    }

    return NextResponse.json({
      success: true,
      mode,
      adapterKind: mode === "standalone" ? adapterKind : undefined,
      adapterTarget: mode === "standalone" ? adapterTarget : undefined,
    });
  } catch (error: unknown) {
    console.error("[api/repo/link] Failed to commit .carf.yml:", error);
    if (error instanceof GitHubContentsError) {
      return NextResponse.json(
        { error: error.message, reason: error.reason },
        { status: error.status || 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to commit .carf.yml to GitHub" },
      { status: 500 }
    );
  }
}
