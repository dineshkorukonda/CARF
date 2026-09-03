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

  account = {} as DashboardPrismaClient["account"];

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
        accountId: create.accountId,
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

  it("permits legitimate claim by Account A", async () => {
    const prisma = new FakeSecurityPrismaClient();
    const row = await linkInstallation(prisma, "account-A", installation);

    expect(row.accountId).toBe("account-A");
    expect(row.installationId).toBe("998877");
    expect(prisma.installations.get("998877")?.accountId).toBe("account-A");
  });

  it("permits idempotency: Account A re-linking its own installation succeeds", async () => {
    const prisma = new FakeSecurityPrismaClient();
    await linkInstallation(prisma, "account-A", installation);
    const row = await linkInstallation(prisma, "account-A", installation);

    expect(row.accountId).toBe("account-A");
  });

  it("strictly prevents Account B from hijacking Account A's installation", async () => {
    const prisma = new FakeSecurityPrismaClient();
    // Claimed first by Account A
    await linkInstallation(prisma, "account-A", installation);

    // Account B attempts to claim the same installationId
    await expect(linkInstallation(prisma, "account-B", installation)).rejects.toThrow(
      InstallationAlreadyLinkedError
    );

    // Ensure the installation still belongs to Account A
    expect(prisma.installations.get("998877")?.accountId).toBe("account-A");
  });
});
