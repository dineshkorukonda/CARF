import { describe, expect, it, vi } from "vitest";
import {
  createPendingRolloutOutcome,
  finalizeRolloutOutcome,
  getPendingRolloutOutcomes,
  type RolloutOutcomePrismaClient,
} from "../../src/adapters/rolloutOutcome.js";

describe("RolloutOutcome persistence helpers", () => {
  it("createPendingRolloutOutcome creates or upserts a PENDING row connected to Commit", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "outcome-1", status: "PENDING" });
    const prisma: RolloutOutcomePrismaClient = {
      rolloutOutcome: {
        findMany: vi.fn(),
        upsert,
        update: vi.fn(),
      },
    };

    const result = await createPendingRolloutOutcome(prisma, {
      owner: "acme",
      repo: "widgets",
      commitSha: "head456",
      installationId: "inst-1",
      threshold: 0.05,
      window: 300,
    });

    expect(result.id).toBe("outcome-1");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          installationId_owner_repo_commitSha: {
            installationId: "inst-1",
            owner: "acme",
            repo: "widgets",
            commitSha: "head456",
          },
        },
        create: expect.objectContaining({
          status: "PENDING",
          threshold: 0.05,
          window: 300,
          commitSha: "head456",
        }),
      })
    );
  });

  it("finalizeRolloutOutcome updates status and terminal metrics", async () => {
    const update = vi.fn().mockResolvedValue({ id: "outcome-1", status: "ROLLED_BACK", rolledBack: true });
    const prisma: RolloutOutcomePrismaClient = {
      rolloutOutcome: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        update,
      },
    };

    const result = await finalizeRolloutOutcome(prisma, {
      id: "outcome-1",
      status: "ROLLED_BACK",
      finalErrorRate: 0.15,
      rolledBack: true,
      rollbackVerified: true,
      reason: "breach detected",
    });

    expect(result.status).toBe("ROLLED_BACK");
    expect(update).toHaveBeenCalledWith({
      where: { id: "outcome-1" },
      data: expect.objectContaining({
        status: "ROLLED_BACK",
        finalErrorRate: 0.15,
        rolledBack: true,
        rollbackVerified: true,
        reason: "breach detected",
      }),
    });
  });

  it("getPendingRolloutOutcomes finds rows with status PENDING", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "outcome-1", status: "PENDING" }]);
    const prisma: RolloutOutcomePrismaClient = {
      rolloutOutcome: {
        findMany,
        upsert: vi.fn(),
        update: vi.fn(),
      },
    };

    const result = await getPendingRolloutOutcomes(prisma);
    expect(result.length).toBe(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { status: "PENDING" },
      orderBy: { startedAt: "asc" },
    });
  });
});
