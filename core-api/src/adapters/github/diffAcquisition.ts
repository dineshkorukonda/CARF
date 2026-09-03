import type { CodeFile } from "../../classifier/codeComplexityScorer.js";
import type { CompareFile, GitHubApiClient, HttpError } from "./githubApiClient.js";

export interface ChangedFile {
  path: string;
  status: CompareFile["status"];
  previousPath?: string | undefined;
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as HttpError).status === 404;
}

export async function getChangedFiles(
  client: GitHubApiClient,
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string,
  token: string
): Promise<ChangedFile[]> {
  const result = await client.compareCommits(owner, repo, baseSha, headSha, token);
  return result.files.map((f) => ({ path: f.filename, status: f.status, previousPath: f.previous_filename }));
}

/** Returns null when the path doesn't exist on that ref (added/removed side of the diff). */
export async function fetchBlobContent(
  client: GitHubApiClient,
  owner: string,
  repo: string,
  path: string,
  ref: string,
  token: string
): Promise<string | null> {
  try {
    return await client.getContent(owner, repo, path, ref, token);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * Orchestrates changed-file listing + before/after blob fetches into the exact shape
 * classifyCommit() expects. core-api never clones a repo or holds local git state —
 * every byte here comes from the GitHub API.
 */
export async function acquireDiff(
  client: GitHubApiClient,
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string,
  token: string
): Promise<CodeFile[]> {
  const changedFiles = await getChangedFiles(client, owner, repo, baseSha, headSha, token);

  return Promise.all(
    changedFiles.map(async (file) => {
      const path = file.path;
      const beforePath = file.status === "renamed" && file.previousPath ? file.previousPath : path;
      const [before, after] = await Promise.all([
        file.status === "added" ? "" : fetchBlobContent(client, owner, repo, beforePath, baseSha, token),
        file.status === "removed" ? "" : fetchBlobContent(client, owner, repo, path, headSha, token),
      ]);
      return { path, before: before ?? "", after: after ?? "" };
    })
  );
}
