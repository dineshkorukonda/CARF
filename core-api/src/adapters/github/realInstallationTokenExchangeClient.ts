import type { HttpError } from "./githubApiClient.js";
import type { InstallationTokenExchangeClient } from "./installationTokenClient.js";
import type { FetchFn } from "./fetchTypes.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Real `InstallationTokenExchangeClient`: exchanges a signed App JWT for a short-lived
 * installation access token via GitHub's REST API. `fetchFn` is injectable (defaults to
 * global `fetch`) so tests never hit the network — same DI convention as `ExecFn` in
 * `kubectl.ts`/`dockerCompose.ts`.
 */
export class RealInstallationTokenExchangeClient implements InstallationTokenExchangeClient {
  constructor(private readonly fetchFn: FetchFn = fetch) {}

  async createInstallationToken(installationId: string, appJwt: string): Promise<{ token: string; expiresAt: string }> {
    const response = await this.fetchFn(`${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw { status: response.status, message } satisfies HttpError;
    }

    const body = (await response.json()) as { token: string; expires_at: string };
    return { token: body.token, expiresAt: body.expires_at };
  }
}
