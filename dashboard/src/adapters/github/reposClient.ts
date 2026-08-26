import type { FetchFn } from "./fetchTypes";

const GITHUB_API_BASE = "https://api.github.com";

export interface InstallationRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
}

/**
 * `GET /installation/repositories` -- installation-token auth, lists exactly the repos
 * this installation can act on (all of them for `repository_selection: "all"`, or the
 * explicitly chosen subset for `"selected"`). Unpaginated for now: fine for the config UI
 * (a picker list), revisit if an installation ever has enough repos to need paging.
 */
export async function listInstallationRepos(
  installationToken: string,
  fetchFn: FetchFn = fetch
): Promise<InstallationRepo[]> {
  const response = await fetchFn(`${GITHUB_API_BASE}/installation/repositories`, {
    headers: {
      Authorization: `Bearer ${installationToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub installation repos fetch failed (status ${response.status})`);
  }

  const body = (await response.json()) as { repositories: InstallationRepo[] };
  return body.repositories;
}
