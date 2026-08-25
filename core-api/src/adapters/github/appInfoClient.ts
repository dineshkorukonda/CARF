import type { HttpError } from "./githubApiClient.js";
import type { FetchFn } from "./fetchTypes.js";

const GITHUB_API_BASE = "https://api.github.com";

export interface Installation {
  id: number;
  account: string;
}

/**
 * App-level (not installation-scoped) GitHub API surface: authenticates with a signed
 * App JWT directly, rather than an installation access token, to answer "is this App's
 * own identity valid and where is it installed" independent of any one target repo.
 */
export interface AppInfoClient {
  listInstallations(appJwt: string): Promise<Installation[]>;
}

/**
 * Real `AppInfoClient`: lists the App's installations via GitHub's REST API. Same
 * injectable-fetch DI convention as `RealInstallationTokenExchangeClient`, so tests never
 * hit the network.
 */
export class RealAppInfoClient implements AppInfoClient {
  constructor(private readonly fetchFn: FetchFn = fetch) {}

  async listInstallations(appJwt: string): Promise<Installation[]> {
    const response = await this.fetchFn(`${GITHUB_API_BASE}/app/installations`, {
      method: "GET",
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

    const body = (await response.json()) as { id: number; account: { login: string } }[];
    return body.map((installation) => ({ id: installation.id, account: installation.account.login }));
  }
}
