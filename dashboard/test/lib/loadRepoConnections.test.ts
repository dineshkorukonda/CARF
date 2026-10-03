import { describe, expect, it, vi } from "vitest";
import { loadRepoConnections, serializeRepoConnection } from "../../src/lib/loadRepoConnections";

describe("serializeRepoConnection", () => {
  it("turns Date fields into ISO strings for client components", () => {
    const serialized = serializeRepoConnection({
      id: "conn-1",
      installationId: "123",
      owner: "dineshkorukonda",
      repo: "Sahaay",
      mode: "standalone",
      verifiedAt: new Date("2026-10-03T00:00:00.000Z"),
      monitoringPaused: false,
      storedConfig: { target: "sahaay" },
      installTokenHash: "hash",
      agentLastHeartbeat: new Date("2026-10-03T01:00:00.000Z"),
      agentRevoked: false,
    });

    expect(serialized.verifiedAt).toBe("2026-10-03T00:00:00.000Z");
    expect(serialized.agentLastHeartbeat).toBe("2026-10-03T01:00:00.000Z");
    expect(serialized.mode).toBe("standalone");
  });
});

describe("loadRepoConnections", () => {
  it("returns serialized rows from findMany", async () => {
    const prisma = {
      repoConnection: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "c1",
            installationId: "1",
            owner: "acme",
            repo: "api",
            mode: "augment",
            verifiedAt: null,
            monitoringPaused: false,
          },
        ]),
      },
    };

    const result = await loadRepoConnections(prisma, ["1"]);
    expect(result.error).toBeNull();
    expect(result.value).toEqual([
      expect.objectContaining({ owner: "acme", repo: "api", mode: "augment" }),
    ]);
  });

  it("falls back to a mode-less raw query when the mode column is missing", async () => {
    const missingMode = Object.assign(new Error("column mode does not exist"), {
      code: "P2022",
      meta: { modelName: "RepoConnection", column: "mode" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const prisma = {
      repoConnection: {
        findMany: vi.fn().mockRejectedValue(missingMode),
      },
      $queryRawUnsafe: vi.fn().mockResolvedValue([
        {
          id: "c1",
          installationId: "1",
          owner: "dineshkorukonda",
          repo: "Sahaay",
          verifiedAt: null,
          monitoringPaused: false,
          storedConfig: { target: "sahaay" },
        },
      ]),
    };

    const result = await loadRepoConnections(prisma, ["1"]);
    errorSpy.mockRestore();

    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    expect(result.value[0]).toMatchObject({ owner: "dineshkorukonda", repo: "Sahaay", mode: null });
    expect(result.error).toMatch(/migrate deploy/);
  });

  it("does not throw when both findMany and the fallback fail", async () => {
    const missingMode = Object.assign(new Error("column mode does not exist"), {
      code: "P2022",
      meta: { modelName: "RepoConnection", column: "mode" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const prisma = {
      repoConnection: {
        findMany: vi.fn().mockRejectedValue(missingMode),
      },
      $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("still failing")),
    };

    const result = await loadRepoConnections(prisma, ["1"]);
    errorSpy.mockRestore();

    expect(result.value).toEqual([]);
    expect(result.error).toMatch(/RepoConnection.mode/);
  });
});
