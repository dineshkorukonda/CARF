import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../config/env";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { signGithubAppJwt } from "../../../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../../../adapters/github/installationTokenClient";
import { getCarfConfigFile, putCarfConfigFile } from "../../../../adapters/github/contentsClient";
import { applyModeAdapterPatch } from "../../../../lib/carfConfigWriter";
import type { AdapterKind } from "../../../../lib/carfConfigSchema";

/**
 * Issue #62's save action: mode + adapter form -> a real commit to the repo's `.carf.yml`,
 * via the installation's own GitHub App credentials (never a user PAT -- see
 * dashboard/CLAUDE.md). Plain HTML form POST (not a Server Action) for the same reason the
 * rest of this package's mutations are route handlers -- see /api/auth/logout, /api/
 * github-app/install/*.
 */
export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.redirect(new URL("/login", env.baseUrl()));
  }

  const form = await request.formData();
  const installationId = String(form.get("installationId") ?? "");
  const owner = String(form.get("owner") ?? "");
  const repo = String(form.get("repo") ?? "");
  const mode = String(form.get("mode") ?? "");
  const adapterKind = String(form.get("adapterKind") ?? "");
  const adapterTarget = String(form.get("adapterTarget") ?? "");

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation || !owner || !repo) {
    return NextResponse.redirect(new URL("/dashboard?error=not_authorized", env.baseUrl()));
  }

  const backTo = new URL(`/dashboard/config/${installationId}`, env.baseUrl());
  backTo.searchParams.set("repo", `${owner}/${repo}`);

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
  } catch {
    const failUrl = new URL(backTo);
    failUrl.searchParams.set("error", "save_failed");
    return NextResponse.redirect(failUrl);
  }

  backTo.searchParams.set("saved", "1");
  return NextResponse.redirect(backTo);
}
