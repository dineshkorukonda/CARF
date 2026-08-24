import { env } from "../../config/env.js";
import { HttpGithubApiClient } from "./httpGithubApiClient.js";
import { InstallationTokenClient } from "./installationTokenClient.js";
import { RealInstallationTokenExchangeClient } from "./realInstallationTokenExchangeClient.js";
import { RealJwtSigner } from "./realJwtSigner.js";

/**
 * Real GitHubApiClient singleton. Needs no env vars at construction time (the
 * installation token is supplied per-call), so it's safe to construct eagerly at module
 * load — importing this module never fails just because env vars aren't set.
 */
export const githubApiClient = new HttpGithubApiClient();

let cachedInstallationTokenClient: InstallationTokenClient | undefined;

/**
 * Lazily constructs the real InstallationTokenClient on first call, not at module load —
 * mirrors src/db/client.ts's lazy-validation convention (see its comment) so importing
 * this module stays safe in test/CI environments without GITHUB_APP_ID/
 * GITHUB_APP_PRIVATE_KEY set. Only calling this function (not importing the module)
 * requires those env vars.
 */
export function getInstallationTokenClient(): InstallationTokenClient {
  if (!cachedInstallationTokenClient) {
    cachedInstallationTokenClient = new InstallationTokenClient(
      new RealInstallationTokenExchangeClient(),
      new RealJwtSigner(),
      env.githubAppId(),
      env.githubAppPrivateKey()
    );
  }
  return cachedInstallationTokenClient;
}
