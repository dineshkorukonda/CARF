import type { FetchFn } from "../adapters/github/fetchTypes";

export interface CiRetryResult {
  runId: number;
  sha?: string;
  url: string;
  status: "requested" | "active" | "error";
  message: string;
}

/** Only rerun the CI workflow. Never invoke deployment or override the branch-tip guard. */
export async function retryCiRuns(input: {
  owner: string; repo: string; branch: string; runIds: number[]; token: string;
}, fetchFn: FetchFn = fetch): Promise<CiRetryResult[]> {
  const repoPath = `${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;
  const base = `https://api.github.com/repos/${repoPath}/actions/runs`;
  const headers = { Authorization: `Bearer ${input.token}`, Accept: "application/vnd.github+json" };
  const retry = async (runId: number): Promise<CiRetryResult> => {
    const result: CiRetryResult = { runId, url: `https://github.com/${repoPath}/actions/runs/${runId}`, status: "error", message: "Could not request retry. Open the run to check its status." };
    try {
      const response = await fetchFn(`${base}/${runId}`, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (!response.ok) return { ...result, message: "CI run is unavailable or access was denied." };
      const run = await response.json() as { name: string; event: string; status: string; head_sha: string; head_branch: string; repository: { full_name: string } };
      if (run.name !== "CI" || run.event !== "push" || run.head_branch !== input.branch || run.repository?.full_name.toLowerCase() !== `${input.owner}/${input.repo}`.toLowerCase()) {
        return { ...result, message: "Only this repository's push CI runs on its deployment branch can be retried." };
      }
      result.sha = run.head_sha;
      if (run.status !== "completed") return { ...result, status: "active", message: "CI is already queued or running." };
      const rerun = await fetchFn(`${base}/${runId}/rerun`, { method: "POST", headers, signal: AbortSignal.timeout(8000) });
      if (rerun.status === 201) return { ...result, status: "requested", message: "Retry requested. GitHub will update this same run." };
      if (rerun.status === 403) return { ...result, message: "GitHub denied retry. The CARF App needs Actions: write permission." };
      if (rerun.status === 422 || rerun.status === 409) return { ...result, message: "GitHub cannot rerun this run now; it may be active or outside the rerun window." };
      return { ...result, message: `GitHub did not accept the retry (HTTP ${rerun.status}).` };
    } catch { return result; }
  };
  // Bound concurrency and return a result for every selected run, including partial failures.
  const results: CiRetryResult[] = [];
  for (let start = 0; start < input.runIds.length; start += 3) {
    results.push(...await Promise.all(input.runIds.slice(start, start + 3).map(retry)));
  }
  return results;
}
