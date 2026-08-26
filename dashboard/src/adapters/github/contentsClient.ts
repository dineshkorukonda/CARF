import type { FetchFn } from "./fetchTypes";

const GITHUB_API_BASE = "https://api.github.com";
const CONFIG_PATH = ".carf.yml";

export interface RepoFile {
  content: string;
  sha: string;
}

/**
 * `GET /repos/{owner}/{repo}/contents/.carf.yml` -- installation-token auth. Returns null
 * when the file doesn't exist yet (a 404 here is an expected, common case: most repos
 * won't have a `.carf.yml` until the dashboard's config UI creates their first one), not
 * an error.
 */
export async function getCarfConfigFile(
  owner: string,
  repo: string,
  installationToken: string,
  fetchFn: FetchFn = fetch
): Promise<RepoFile | null> {
  const response = await fetchFn(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${CONFIG_PATH}`, {
    headers: {
      Authorization: `Bearer ${installationToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub .carf.yml fetch failed (status ${response.status})`);
  }

  const body = (await response.json()) as { content: string; encoding: string; sha: string };
  const content = body.encoding === "base64" ? Buffer.from(body.content, "base64").toString("utf-8") : body.content;
  return { content, sha: body.sha };
}

/**
 * `PUT /repos/{owner}/{repo}/contents/.carf.yml` -- creates the file if `previousSha` is
 * undefined, otherwise updates it (GitHub's Contents API requires the current file's `sha`
 * for an update, to detect concurrent-edit conflicts -- a stale/wrong `previousSha` 409s).
 * Commits as the CARF GitHub App itself (the installation token's identity), not the
 * logged-in dashboard user -- there's no user PAT in this flow, by design (see
 * dashboard/CLAUDE.md's "never a bare PAT" rule).
 */
export async function putCarfConfigFile(
  owner: string,
  repo: string,
  yamlContent: string,
  commitMessage: string,
  installationToken: string,
  previousSha: string | undefined,
  fetchFn: FetchFn = fetch
): Promise<void> {
  const response = await fetchFn(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${CONFIG_PATH}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${installationToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: commitMessage,
      content: Buffer.from(yamlContent, "utf-8").toString("base64"),
      sha: previousSha,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub .carf.yml commit failed (status ${response.status})`);
  }
}
