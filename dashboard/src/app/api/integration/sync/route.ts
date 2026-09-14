import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { listInstallationsForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { env } from "../../../../config/env";
import { signGithubAppJwt } from "../../../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../../../adapters/github/installationTokenClient";
import { listInstallationRepos } from "../../../../adapters/github/reposClient";

export async function POST() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const installations = await listInstallationsForAccount(prisma, account.id);
  if (installations.length === 0) {
    return NextResponse.json({ error: "no_integration_found" }, { status: 404 });
  }

  const primary = installations[0]!;

  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const { token } = await createInstallationToken(primary.installationId, appJwt);
    const repos = await listInstallationRepos(token);

    return NextResponse.json({
      ok: true,
      installationId: primary.installationId,
      targetLogin: primary.targetLogin,
      count: repos.length,
      repositories: repos,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[integration/sync] failed to sync repos:", err);
    return NextResponse.json(
      { error: "sync_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
