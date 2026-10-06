import type { FetchFn } from "./fetchTypes.js";

/** Fail closed: only the repository's successful push CI for this exact revision authorizes deployment. */
export async function verifyDeploymentCi(
  input: { owner: string; repo: string; branch: string; sha: string; runId: number; token: string; ciWorkflowName?: string },
  fetchFn: FetchFn = fetch,
): Promise<void> {
  const response = await fetchFn(`https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/runs/${input.runId}`, {
    headers: { Authorization: `Bearer ${input.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Cannot verify CI (GitHub HTTP ${response.status}). Grant the CARF GitHub App Actions: Read access.`);
  const run = await response.json() as {
    name?: string; status?: string; conclusion?: string; event?: string; head_sha?: string;
    head_branch?: string; head_repository?: { full_name?: string }; repository?: { full_name?: string };
  };
  const repository = `${input.owner}/${input.repo}`.toLowerCase();
  const isCarfDeployment = run.name === "CARF PM2 Deployment" || run.name === "CARF Deployment";
  const validWorkflowName = input.ciWorkflowName
    ? run.name?.toLowerCase() === input.ciWorkflowName.toLowerCase()
    : Boolean(run.name && !isCarfDeployment);

  if (!validWorkflowName || run.status !== "completed" || run.conclusion !== "success" || run.event !== "push" ||
    run.head_sha?.toLowerCase() !== input.sha || run.head_branch !== input.branch ||
    run.repository?.full_name?.toLowerCase() !== repository || run.head_repository?.full_name?.toLowerCase() !== repository) {
    throw new Error("Deployment requires a successful CI push run for the exact SHA, branch, and repository");
  }
  // Workflow-run responses contain a minimal repository without default_branch.
  const repositoryResponse = await fetchFn(`https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`, {
    headers: { Authorization: `Bearer ${input.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!repositoryResponse.ok) throw new Error(`Cannot verify deployment branch (GitHub HTTP ${repositoryResponse.status})`);
  const details = await repositoryResponse.json() as { default_branch?: string };
  if (details.default_branch !== input.branch) throw new Error("Deployment requires CI on the repository default branch");
}
