import { describe, expect, it } from "vitest";
import {
  getInstallationForAccount,
  linkInstallation,
  listInstallationsForAccount,
  saveCoreApiKey,
  InstallationAlreadyLinkedError,
  type DashboardPrismaClient,
  type InstallationRow,
} from "../../src/lib/accountService";
import type { GithubInstallation } from "../../src/adapters/github/appInstallClient";

class FakeDashboardPrismaClient implements DashboardPrismaClient {
  installations = new Map<string, InstallationRow>();
  private nextId = 1;

  installation = {
    findUnique: async (args: { where: { installationId: string } }) =>
      [...this.installations.values()].find((i) => i.installationId === args.where.installationId) ?? null,
    findFirst: async (args: { where: { userId?: string; accountId?: string; installationId: string } }) =>
      [...this.installations.values()].find(
        (i) => (i.userId === args.where.userId || i.userId === args.where.accountId) && i.installationId === args.where.installationId
      ) ?? null,
    upsert: async (args: {
      where: { installationId: string };
      create: {
        installationId: string;
        userId: string;
        targetLogin: string;
        targetType: string;
        repositorySelection: string;
      };
      update: { targetLogin: string; targetType: string; repositorySelection: string };
    }) => {
      const existing = [...this.installations.values()].find((i) => i.installationId === args.where.installationId);
      if (existing) {
        const updated: InstallationRow = { ...existing, ...args.update };
        this.installations.set(existing.id, updated);
        return updated;
      }
      const row: InstallationRow = {
        id: `installation-${this.nextId++}`,
        createdAt: new Date(),
        coreApiKey: null,
        ...args.create,
      };
      this.installations.set(row.id, row);
      return row;
    },
    findMany: async (args: { where: { userId?: string; accountId?: string } }) =>
      [...this.installations.values()].filter(
        (i) => i.userId === (args.where.userId ?? args.where.accountId)
      ),
    update: async (args: { where: { installationId: string }; data: { coreApiKey: string } }) => {
      const existing = [...this.installations.values()].find((i) => i.installationId === args.where.installationId);
      if (!existing) throw new Error(`no installation ${args.where.installationId}`);
      const updated: InstallationRow = { ...existing, ...args.data };
      this.installations.set(existing.id, updated);
      return updated;
    },
  };
}

describe("linkInstallation / listInstallationsForAccount", () => {
  const installation: GithubInstallation = {
    id: 999,
    account: { login: "acme", type: "Organization" },
    repository_selection: "all",
  };

  it("links a new installation to the user", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const userId = "user-123";

    await linkInstallation(prisma, userId, installation);
    const installations = await listInstallationsForAccount(prisma, userId);

    expect(installations).toHaveLength(1);
    expect(installations[0]).toMatchObject({
      installationId: "999",
      userId: "user-123",
      targetLogin: "acme",
      targetType: "Organization",
      repositorySelection: "all",
    });
  });

  it("re-linking the same installationId updates the existing row instead of duplicating it", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const userId = "user-123";

    await linkInstallation(prisma, userId, installation);
    await linkInstallation(prisma, userId, { ...installation, repository_selection: "selected" });

    const installations = await listInstallationsForAccount(prisma, userId);
    expect(installations).toHaveLength(1);
    expect(installations[0]?.repositorySelection).toBe("selected");
  });

  it("rejects linking an installation already claimed by another user", async () => {
    const prisma = new FakeDashboardPrismaClient();
    await linkInstallation(prisma, "user-1", installation);

    await expect(linkInstallation(prisma, "user-2", installation)).rejects.toBeInstanceOf(
      InstallationAlreadyLinkedError
    );
  });

  it("falls back to 'unknown' when GitHub reports no installation account", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const userId = "user-123";

    await linkInstallation(prisma, userId, { ...installation, account: null });
    const installations = await listInstallationsForAccount(prisma, userId);

    expect(installations[0]).toMatchObject({ targetLogin: "unknown", targetType: "unknown" });
  });
});

describe("getInstallationForAccount", () => {
  const installation: GithubInstallation = {
    id: 999,
    account: { login: "acme", type: "Organization" },
    repository_selection: "all",
  };

  it("returns the installation when it belongs to the given user", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const userId = "user-123";
    await linkInstallation(prisma, userId, installation);

    const found = await getInstallationForAccount(prisma, userId, "999");
    expect(found).toMatchObject({ installationId: "999", userId });
  });

  it("returns null when the installation belongs to a different user", async () => {
    const prisma = new FakeDashboardPrismaClient();
    await linkInstallation(prisma, "user-1", installation);

    expect(await getInstallationForAccount(prisma, "user-2", "999")).toBeNull();
  });

  it("returns null for an unknown installationId", async () => {
    const prisma = new FakeDashboardPrismaClient();
    expect(await getInstallationForAccount(prisma, "user-1", "does-not-exist")).toBeNull();
  });
});

describe("saveCoreApiKey", () => {
  it("persists the key on the installation row", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const userId = "user-123";
    await linkInstallation(prisma, userId, {
      id: 999,
      account: { login: "acme", type: "Organization" },
      repository_selection: "all",
    });

    await saveCoreApiKey(prisma, "999", "carf_the-key");

    const found = await getInstallationForAccount(prisma, userId, "999");
    expect(found?.coreApiKey).toBe("carf_the-key");
  });
});
