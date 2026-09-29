import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest } from "../auth";
import { signGithubAppJwt } from "../../../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../../../adapters/github/installationTokenClient";
import { getCarfConfigFile } from "../../../../adapters/github/contentsClient";
import { load } from "js-yaml";
import { env } from "../../../../config/env";

export async function GET(request: NextRequest) {
  const auth = await authenticateAgentRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { connection } = auth;

  // 1. Try to fetch .carf.yml from GitHub repository
  let parsedConfig: unknown = connection.storedConfig;
  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const { token } = await createInstallationToken(connection.installationId, appJwt);
    const configFile = await getCarfConfigFile(connection.owner, connection.repo, token);
    if (configFile?.content) {
      const loaded = load(configFile.content);
      if (typeof loaded === "object" && loaded !== null) {
        parsedConfig = loaded;
      }
    }
  } catch {
    // If GitHub API fails or file does not exist, fallback to connection.storedConfig
  }

  return NextResponse.json({
    owner: connection.owner,
    repo: connection.repo,
    installationId: connection.installationId,
    monitoringPaused: connection.monitoringPaused,
    config: parsedConfig,
  });
}
