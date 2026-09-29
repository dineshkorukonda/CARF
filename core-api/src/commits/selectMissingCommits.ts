export interface ListedCommit {
  sha: string;
  /** First parent. Null for a root commit, which cannot be diffed against a base. */
  parentSha: string | null;
}

/**
 * Commits on the branch (newest first) that this installation has not classified yet.
 * Returned oldest first so a parent is classified before its child. Root commits are
 * skipped: there is no base SHA to diff against.
 */
export function selectMissingCommits(
  branchCommitsNewestFirst: ListedCommit[],
  knownShas: ReadonlySet<string>,
): Array<{ sha: string; parentSha: string }> {
  const missing: Array<{ sha: string; parentSha: string }> = [];
  for (const commit of [...branchCommitsNewestFirst].reverse()) {
    if (commit.parentSha && !knownShas.has(commit.sha)) {
      missing.push({ sha: commit.sha, parentSha: commit.parentSha });
    }
  }
  return missing;
}
