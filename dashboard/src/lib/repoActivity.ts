/**
 * Rollout/commit reads on the repositories screens. A schema mismatch (missing
 * table or column) used to throw out of the server component and replace the
 * whole page with a generic server error, which hides the GitHub repo list
 * during standalone testing. These reads fail soft instead.
 */

export interface ListedRepo {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  default_branch: string;
  private: boolean;
}

function repoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

function syntheticRepoId(owner: string, repo: string): number {
  const s = repoKey(owner, repo);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

/**
 * The GitHub App installation can grant dozens of repos. The dashboard list
 * only shows repositories that have a RepoConnection row (setup / verify /
 * .carf.yml link), not every repo the App can see.
 */
export function listIntegratedRepos(
  githubRepos: ListedRepo[],
  connections: { owner: string; repo: string }[],
): ListedRepo[] {
  const connected = new Set(connections.map((c) => repoKey(c.owner, c.repo)));
  const fromGithub = githubRepos.filter((r) => connected.has(repoKey(r.owner, r.name)));
  const seen = new Set(fromGithub.map((r) => repoKey(r.owner, r.name)));
  const extras: ListedRepo[] = [];
  for (const c of connections) {
    const key = repoKey(c.owner, c.repo);
    if (seen.has(key)) continue;
    extras.push({
      id: syntheticRepoId(c.owner, c.repo),
      name: c.repo,
      full_name: `${c.owner}/${c.repo}`,
      owner: c.owner,
      default_branch: "main",
      private: false,
    });
  }
  return [...fromGithub, ...extras];
}

export function activityErrorMessage(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
  const meta =
    err && typeof err === "object" && "meta" in err && (err as { meta: unknown }).meta && typeof (err as { meta: unknown }).meta === "object"
      ? (err as { meta: Record<string, unknown> }).meta
      : null;
  const detail = meta
    ? [meta.modelName, meta.table, meta.column, meta.field_name].filter((v) => typeof v === "string").join(" ")
    : "";
  if (code === "P2021" || code === "P2022") {
    const suffix = detail ? ` Missing: ${detail}.` : "";
    return `Rollout history is unavailable because the database is missing a table or column the app expects.${suffix} In Neon SQL, run core-api/prisma/repair-rollout-schema.sql then reload.`;
  }
  return "Rollout history could not be loaded. Repositories from the GitHub App are still listed.";
}

export async function readOrEmpty<T>(
  label: string,
  read: () => Promise<T>,
  empty: T,
): Promise<{ value: T; error: string | null }> {
  try {
    return { value: await read(), error: null };
  } catch (err) {
    console.error(label, err);
    return { value: empty, error: activityErrorMessage(err) };
  }
}
