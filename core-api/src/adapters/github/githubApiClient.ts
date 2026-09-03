export interface CompareFile {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed";
  previous_filename?: string | undefined;
}

export interface CompareResult {
  files: CompareFile[];
}

export interface HttpError {
  status: number;
  message?: string;
}

/**
 * Interface-based GitHub API client so diff acquisition + classifier tests never hit
 * the network. The real implementation wraps GitHub's REST API using an installation
 * token from adapters/github/installationTokenClient.ts (see issue #16).
 */
export interface GitHubApiClient {
  compareCommits(owner: string, repo: string, base: string, head: string, token: string): Promise<CompareResult>;
  /** Rejects with an HttpError (status 404 when the path doesn't exist on that ref). */
  getContent(owner: string, repo: string, path: string, ref: string, token: string): Promise<string>;
}
