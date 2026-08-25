/**
 * Persists what actually happened during a live Standalone rollback loop (issue #54) --
 * as opposed to Threshold, which records what CARF *decided* the threshold/window should
 * be. Deliberately no query/read side here yet: see README's "Telemetry" section for why
 * exposing this over an endpoint is deferred until real caller auth exists (issue #61).
 */

/** Minimal seam over the subset of PrismaClient's API this module needs. */
export interface RolloutOutcomePrismaClient {
  rolloutOutcome: {
    create(args: {
      data: {
        commit: { connect: { owner_repo_sha: { owner: string; repo: string; sha: string } } };
        installationId?: string;
        rolledBack: boolean;
        finalErrorRate: number;
        durationMs: number;
      };
    }): Promise<unknown>;
  };
}

export interface RolloutOutcomeParams {
  owner: string;
  repo: string;
  sha: string;
  installationId?: string;
  rolledBack: boolean;
  finalErrorRate: number;
  durationMs: number;
}

export async function recordRolloutOutcome(prisma: RolloutOutcomePrismaClient, params: RolloutOutcomeParams): Promise<void> {
  await prisma.rolloutOutcome.create({
    data: {
      commit: { connect: { owner_repo_sha: { owner: params.owner, repo: params.repo, sha: params.sha } } },
      ...(params.installationId !== undefined ? { installationId: params.installationId } : {}),
      rolledBack: params.rolledBack,
      finalErrorRate: params.finalErrorRate,
      durationMs: params.durationMs,
    },
  });
}
