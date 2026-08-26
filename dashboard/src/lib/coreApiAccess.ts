import { env } from "../config/env";
import { signGithubAppJwt } from "../adapters/github/appInstallClient";
import { fetchInstallationApiKey } from "../adapters/coreApi/client";
import { saveCoreApiKey, type DashboardPrismaClient, type InstallationRow } from "./accountService";

/**
 * Returns a usable core-api installation API key for `installation`, fetching (and
 * caching -- see prisma/schema.prisma's `coreApiKey` doc comment) a fresh one from
 * core-api's key-issuance endpoint the first time this installation needs one.
 */
export async function ensureCoreApiKey(prisma: DashboardPrismaClient, installation: InstallationRow): Promise<string> {
  if (installation.coreApiKey) return installation.coreApiKey;

  const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
  const apiKey = await fetchInstallationApiKey(env.coreApiBaseUrl(), installation.installationId, appJwt);
  await saveCoreApiKey(prisma, installation.installationId, apiKey);
  return apiKey;
}
