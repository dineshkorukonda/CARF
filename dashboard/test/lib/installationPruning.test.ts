import { beforeEach, describe, expect, it, vi } from "vitest";
import { pruneStaleInstallations, resetPruneThrottle } from "../../src/lib/installationPruning";
import type { InstallationRow } from "../../src/lib/accountService";

const row = (installationId: string): InstallationRow => ({
  id: installationId,
  installationId,
  userId: "u1",
  targetLogin: "me",
  targetType: "User",
  repositorySelection: "all",
  coreApiKey: null,
  createdAt: new Date(),
});

describe("pruneStaleInstallations", () => {
  beforeEach(() => resetPruneThrottle());

  it("deletes installations GitHub says are gone, keeps live and unknown ones", async () => {
    const prisma = {
      installation: { delete: vi.fn().mockResolvedValue({}) },
      repoConnection: { deleteMany: vi.fn().mockResolvedValue({}) },
    };
    const exists = vi.fn(async (id: string) => (id === "old" ? false : id === "new" ? true : ("unknown" as const)));
    const result = await pruneStaleInstallations(prisma, "u1", [row("old"), row("new"), row("flaky")], exists);
    expect(result.map((r) => r.installationId)).toEqual(["new", "flaky"]);
    expect(prisma.installation.delete).toHaveBeenCalledTimes(1);
    expect(prisma.installation.delete).toHaveBeenCalledWith({ where: { installationId: "old" } });
    expect(prisma.repoConnection.deleteMany).toHaveBeenCalledWith({ where: { installationId: "old" } });
  });

  it("is throttled per user", async () => {
    const prisma = { installation: { delete: vi.fn() } };
    const exists = vi.fn(async () => true);
    await pruneStaleInstallations(prisma, "u1", [row("a")], exists);
    await pruneStaleInstallations(prisma, "u1", [row("a")], exists);
    expect(exists).toHaveBeenCalledTimes(1);
  });
});
