export interface CiRun {
  id: number;
  status: string;
  conclusion: string | null;
  url: string;
}
export interface CiSnapshot {
  headSha: string | null;
  runs: Record<string, CiRun>;
  unavailable: boolean;
  deployments?: Record<string, CiRun>;
}

export function commitCiStage(sha: string, ci?: CiSnapshot): string {
  if (!ci || ci.unavailable) return "CI status unavailable";
  const run = ci.runs[sha];
  if (run?.status === "completed" && run.conclusion !== "success") {
    if (run.conclusion === "cancelled") return "CI cancelled";
    if (run.conclusion === "skipped") return "CI skipped";
    return "CI failed";
  }
  const deployment = ci.deployments?.[sha];
  if (deployment?.status === "in_progress") return "Deployment running";
  if (deployment?.status === "queued") return "Deployment queued";
  if (ci.headSha && sha !== ci.headSha) return "Superseded";
  if (deployment?.status === "completed" && deployment.conclusion !== "success") {
    return deployment.conclusion === "skipped" ? "Deployment skipped" : deployment.conclusion === "cancelled" ? "Deployment cancelled" : "Deployment failed";
  }
  if (deployment?.conclusion === "success") return "Deployment completed";
  if (!run) return "Waiting for CI";
  if (run.status === "in_progress") return "CI running";
  if (run.status !== "completed") return "CI queued";
  return "Waiting for deployment";
}

export function ciIsActive(ci?: CiSnapshot): boolean {
  return !!ci && !ci.unavailable && !!ci.headSha &&
    ["Waiting for CI", "CI running", "CI queued", "Waiting for deployment", "Deployment running", "Deployment queued"].includes(commitCiStage(ci.headSha, ci));
}
