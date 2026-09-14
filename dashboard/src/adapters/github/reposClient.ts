import type { FetchFn } from "./fetchTypes";

const GITHUB_API_BASE = "https://api.github.com";

export interface InstallationRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
  private?: boolean;
  description?: string | null;
  pushed_at?: string | null;
  updated_at?: string | null;
}

/**
 * `GET /installation/repositories` -- installation-token auth.
 * Paginates with `per_page=100` to ensure all granted repositories are retrieved
 * (not just the first 30 default), and sorts by most recently pushed/updated first.
 */
export async function listInstallationRepos(
  installationToken: string,
  fetchFn: FetchFn = fetch
): Promise<InstallationRepo[]> {
  const allRepos: InstallationRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetchFn(
      `${GITHUB_API_BASE}/installation/repositories?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${installationToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub installation repos fetch failed (status ${response.status})`);
    }

    const body = (await response.json()) as { total_count: number; repositories: InstallationRepo[] };
    allRepos.push(...body.repositories);

    if (allRepos.length >= body.total_count || body.repositories.length < perPage) {
      break;
    }
    page += 1;
  }

  // Sort by most recently pushed/updated first so recent active repos appear at the top
  allRepos.sort((a, b) => {
    const timeA = new Date(a.pushed_at ?? a.updated_at ?? 0).getTime();
    const timeB = new Date(b.pushed_at ?? b.updated_at ?? 0).getTime();
    return timeB - timeA;
  });

  return allRepos;
}
