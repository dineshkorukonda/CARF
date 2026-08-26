import { env } from "../config/env";
import { signGithubAppJwt } from "../adapters/github/appInstallClient";
import { createInstallationToken } from "../adapters/github/installationTokenClient";

/** Mints a fresh short-lived installation access token for `installationId`. Shared by
 *  every config page/route that needs to read or write a repo's `.carf.yml` on that
 *  installation's behalf (see #62/#63). */
export async function mintInstallationToken(installationId: string): Promise<string> {
  const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
  const { token } = await createInstallationToken(installationId, appJwt);
  return token;
}
