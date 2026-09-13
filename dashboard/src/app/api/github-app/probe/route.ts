import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { listInstallationsForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { env } from "../../../../config/env";
import { runGithubAppProbe } from "../../../../adapters/github/appProbeClient";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let localInstallationIds: string[] = [];
  try {
    const installations = await listInstallationsForAccount(prisma, account.id);
    localInstallationIds = installations.map((i) => i.installationId);
  } catch (err) {
    console.error("Failed to load account installations for probe:", err);
  }

  let probeEnv = {
    appId: "",
    appSlug: "",
    privateKey: "",
    coreApiBaseUrl: "",
  };

  try {
    probeEnv = {
      appId: env.githubAppId(),
      appSlug: env.githubAppSlug(),
      privateKey: env.githubAppPrivateKey(),
      coreApiBaseUrl: env.coreApiBaseUrl(),
    };
  } catch {
    probeEnv = {
      appId: process.env.GITHUB_APP_ID ?? "",
      appSlug: process.env.GITHUB_APP_SLUG ?? "",
      privateKey: (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
      coreApiBaseUrl: process.env.CORE_API_BASE_URL ?? "",
    };
  }

  const report = await runGithubAppProbe({
    env: probeEnv,
    localInstallationIds,
  });

  return NextResponse.json(report);
}
