import { describe, expect, it, vi } from "vitest";
import { recordRolloutOutcome, type RolloutOutcomePrismaClient } from "../../src/adapters/rolloutOutcome.js";

describe("recordRolloutOutcome", () => {
  it("creates a RolloutOutcome row connected to the Commit via the owner/repo/sha unique key", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const prisma: RolloutOutcomePrismaClient = { rolloutOutcome: { create } };

    await recordRolloutOutcome(prisma, {
      owner: "acme",
      repo: "widgets",
      sha: "head456",
      installationId: "inst-1",
      rolledBack: true,
      finalErrorRate: 0.2,
      durationMs: 10_000,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        commit: { connect: { owner_repo_sha: { owner: "acme", repo: "widgets", sha: "head456" } } },
        installationId: "inst-1",
        rolledBack: true,
        finalErrorRate: 0.2,
        durationMs: 10_000,
      },
    });
  });

  it("omits installationId when not provided", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const prisma: RolloutOutcomePrismaClient = { rolloutOutcome: { create } };

    await recordRolloutOutcome(prisma, {
      owner: "acme",
      repo: "widgets",
      sha: "head456",
      rolledBack: false,
      finalErrorRate: 0.01,
      durationMs: 30_000,
    });

    const [args] = create.mock.calls[0]!;
    expect(args.data).not.toHaveProperty("installationId");
  });

  it("propagates a rejection from the underlying create (e.g. no matching Commit row)", async () => {
    const create = vi.fn().mockRejectedValue(new Error("no Commit found"));
    const prisma: RolloutOutcomePrismaClient = { rolloutOutcome: { create } };

    await expect(
      recordRolloutOutcome(prisma, {
        owner: "acme",
        repo: "widgets",
        sha: "unknown-sha",
        rolledBack: false,
        finalErrorRate: 0,
        durationMs: 0,
      })
    ).rejects.toThrow("no Commit found");
  });
});
