import { describe, expect, it, vi } from "vitest";
import {
  linkInstallation,
  InstallationAlreadyLinkedError,
  type DashboardPrismaClient,
  type InstallationRow,
} from "../../src/lib/accountService";
import type { GithubInstallation } from "../../src/adapters/github/appInstallClient";

class FakeSecurityPrismaClient implements DashboardPrismaClient {
  public installations = new Map<string, InstallationRow>();

  installation = {
    findUnique: vi.fn(async ({ where }: { where: { installationId: string } }) => {
      return this.installations.get(where.installationId) ?? null;
    }),
    findFirst: vi.fn(async () => null),
    upsert: vi.fn(async ({ where, create, update }: Parameters<DashboardPrismaClient["installation"]["upsert"]>[0]) => {
      const existing = this.installations.get(where.installationId);
      if (existing) {
        const updated = { ...existing, ...update };
        this.installations.set(where.installationId, updated);
        return updated;
      }
      const row: InstallationRow = {
        id: "inst-row-id",
        installationId: create.installationId,
        userId: create.userId,
        targetLogin: create.targetLogin,
        targetType: create.targetType,
        repositorySelection: create.repositorySelection,
        coreApiKey: null,
        createdAt: new Date(),
      };
      this.installations.set(where.installationId, row);
      return row;
    }),
    findMany: vi.fn(async () => []),
    update: vi.fn(async () => ({} as unknown as InstallationRow)),
  };
}

describe("Regression: GitHub Installation Claim Security & Anti-Hijacking", () => {
  const installation: GithubInstallation = {
    id: 998877,
    account: { login: "victim-org", type: "Organization" },
    repository_selection: "all",
  };

  it("permits legitimate claim by User A", async () => {
    const prisma = new FakeSecurityPrismaClient();
    const row = await linkInstallation(prisma, "user-A", installation);

    expect(row.userId).toBe("user-A");
    expect(row.installationId).toBe("998877");
    expect(prisma.installations.get("998877")?.userId).toBe("user-A");
  });

  it("permits idempotency: User A re-linking its own installation succeeds", async () => {
    const prisma = new FakeSecurityPrismaClient();
    await linkInstallation(prisma, "user-A", installation);
    const row = await linkInstallation(prisma, "user-A", installation);

    expect(row.userId).toBe("user-A");
  });

  it("strictly prevents User B from hijacking User A's installation", async () => {
    const prisma = new FakeSecurityPrismaClient();
    // Claimed first by User A
    await linkInstallation(prisma, "user-A", installation);

    // User B attempts to claim the same installationId
    await expect(linkInstallation(prisma, "user-B", installation)).rejects.toThrow(
      InstallationAlreadyLinkedError
    );

    // Ensure the installation still belongs to User A
    expect(prisma.installations.get("998877")?.userId).toBe("user-A");
  });
});
