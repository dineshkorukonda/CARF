import type { CompareFile, CompareResult, GitHubApiClient, HttpError } from "./githubApiClient.js";
import type { FetchFn } from "./fetchTypes.js";

const GITHUB_API_BASE = "https://api.github.com";

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function encodePathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Real `GitHubApiClient`: wraps GitHub's REST API using an installation token from
 * `installationTokenClient.ts`. `fetchFn` is injectable (defaults to global `fetch`) so
 * `diffAcquisition.ts`'s tests (and this class's own tests) never hit the network.
 *
 * `compareCommits` reads a single page only — GitHub's compare endpoint returns up to
 * 300 changed files with no pagination on this endpoint; a commit touching more files
 * than that sees a truncated diff. Documented limitation, not handled here.
 */
export class HttpGithubApiClient implements GitHubApiClient {
  constructor(private readonly fetchFn: FetchFn = fetch) {}

  async compareCommits(owner: string, repo: string, base: string, head: string, token: string): Promise<CompareResult> {
    const response = await this.fetchFn(`${GITHUB_API_BASE}/repos/${owner}/${repo}/compare/${base}...${head}`, {
      headers: authHeaders(token),
    });

    if (!response.ok) {
      const message = await response.text();
      throw { status: response.status, message } satisfies HttpError;
    }

    const body = (await response.json()) as { files?: Array<{ filename: string; status: string; previous_filename?: string }> };
    const files: CompareFile[] = (body.files ?? []).map((f) => ({
      filename: f.filename,
      status: f.status as CompareFile["status"],
      previous_filename: f.previous_filename,
    }));
    return { files };
  }

  async getContent(owner: string, repo: string, path: string, ref: string, token: string): Promise<string> {
    const encodedPath = encodePathSegments(path);
    const response = await this.fetchFn(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
      { headers: authHeaders(token) }
    );

    if (!response.ok) {
      const message = await response.text();
      throw { status: response.status, message } satisfies HttpError;
    }

    const body = (await response.json()) as { content: string; encoding: string };
    if (body.encoding !== "base64") {
      throw new Error(`getContent: unexpected encoding "${body.encoding}" for ${path}@${ref}`);
    }
    return Buffer.from(body.content, "base64").toString("utf-8");
  }
}
