import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../config/env";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { signGithubAppJwt } from "../../../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../../../adapters/github/installationTokenClient";
import { getCarfConfigFile, putCarfConfigFile, GitHubContentsError } from "../../../../adapters/github/contentsClient";
import { applyModeAdapterPatch } from "../../../../lib/carfConfigWriter";
import type { AdapterKind } from "../../../../lib/carfConfigSchema";

/**
 * Commits mode/adapter to `.carf.yml`. Always returns JSON.
 * Must not redirect to /dashboard/config/:id — that page no longer exists, and fetch()
 * following a 307/303 onto it produced a 404 HTML body in the setup wizard.
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

  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      installationId = String(body.installationId ?? "");
      owner = String(body.owner ?? "");
      repo = String(body.repo ?? "");
      mode = String(body.mode ?? "");
      adapterKind = String(body.adapterKind ?? "");
      adapterTarget = String(body.adapterTarget ?? "");
    } else {
      const form = await request.formData();
      installationId = String(form.get("installationId") ?? "");
      owner = String(form.get("owner") ?? "");
      repo = String(form.get("repo") ?? "");
      mode = String(form.get("mode") ?? "");
      adapterKind = String(form.get("adapterKind") ?? "");
      adapterTarget = String(form.get("adapterTarget") ?? "");
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation || !owner || !repo) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 403 });
  }

  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const { token } = await createInstallationToken(installationId, appJwt);
    const existingFile = await getCarfConfigFile(owner, repo, token);

    const nextYaml = applyModeAdapterPatch(existingFile?.content ?? null, {
      mode: mode === "standalone" ? "standalone" : "augment",
      adapter:
        mode === "standalone" ? { kind: adapterKind as AdapterKind, target: adapterTarget } : undefined,
    });

    await putCarfConfigFile(
      owner,
      repo,
      nextYaml,
      "chore: update CARF mode/adapter via dashboard",
      token,
      existingFile?.sha
    );

    return NextResponse.json({ success: true, mode, owner, repo });
  } catch (error: unknown) {
    console.error("[config/save] Failed to save .carf.yml:", error);
    if (error instanceof GitHubContentsError) {
      return NextResponse.json({ error: error.message, reason: error.reason }, { status: error.status || 502 });
    }
    return NextResponse.json({ error: "Failed to commit .carf.yml to GitHub" }, { status: 502 });
  }
}
