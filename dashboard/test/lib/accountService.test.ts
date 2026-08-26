import { describe, expect, it } from "vitest";
import {
  createAccount,
  EmailAlreadyRegisteredError,
  getInstallationForAccount,
  linkInstallation,
  listInstallationsForAccount,
  saveCoreApiKey,
  verifyCredentials,
  type AccountRow,
  type DashboardPrismaClient,
  type InstallationRow,
} from "../../src/lib/accountService";
import type { GithubInstallation } from "../../src/adapters/github/appInstallClient";

class FakeDashboardPrismaClient implements DashboardPrismaClient {
  accounts = new Map<string, AccountRow>();
  installations = new Map<string, InstallationRow>();
  private nextId = 1;

  account = {
    create: async (args: { data: { email: string; passwordHash: string } }) => {
      const row: AccountRow = { id: `account-${this.nextId++}`, ...args.data };
      this.accounts.set(row.id, row);
      return row;
    },
    findUnique: async (args: { where: { email: string } }) =>
      [...this.accounts.values()].find((a) => a.email === args.where.email) ?? null,
  };

  installation = {
    findFirst: async (args: { where: { accountId: string; installationId: string } }) =>
      [...this.installations.values()].find(
        (i) => i.accountId === args.where.accountId && i.installationId === args.where.installationId
      ) ?? null,
    upsert: async (args: {
      where: { installationId: string };
      create: {
        installationId: string;
        accountId: string;
        targetLogin: string;
        targetType: string;
        repositorySelection: string;
      };
      update: { targetLogin: string; targetType: string; repositorySelection: string };
    }) => {
      const existing = [...this.installations.values()].find((i) => i.installationId === args.where.installationId);
      if (existing) {
        const updated = { ...existing, ...args.update };
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
    findMany: async (args: { where: { accountId: string } }) =>
      [...this.installations.values()].filter((i) => i.accountId === args.where.accountId),
    update: async (args: { where: { installationId: string }; data: { coreApiKey: string } }) => {
      const existing = [...this.installations.values()].find((i) => i.installationId === args.where.installationId);
      if (!existing) throw new Error(`no installation ${args.where.installationId}`);
      const updated = { ...existing, ...args.data };
      this.installations.set(existing.id, updated);
      return updated;
    },
  };
}

describe("createAccount / verifyCredentials", () => {
  it("creates a new Account with a hashed (not plaintext) password", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await createAccount(prisma, "person@example.com", "correct horse battery");
    expect(account.email).toBe("person@example.com");
    expect(account.passwordHash).not.toBe("correct horse battery");
  });

  it("rejects signup with an email that's already registered", async () => {
    const prisma = new FakeDashboardPrismaClient();
    await createAccount(prisma, "person@example.com", "correct horse battery");
    await expect(createAccount(prisma, "person@example.com", "another password")).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError
    );
  });

  it("verifies correct credentials and returns the account", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const created = await createAccount(prisma, "person@example.com", "correct horse battery");
    const verified = await verifyCredentials(prisma, "person@example.com", "correct horse battery");
    expect(verified?.id).toBe(created.id);
  });

  it("returns null for a wrong password", async () => {
    const prisma = new FakeDashboardPrismaClient();
    await createAccount(prisma, "person@example.com", "correct horse battery");
    expect(await verifyCredentials(prisma, "person@example.com", "wrong password")).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    const prisma = new FakeDashboardPrismaClient();
    expect(await verifyCredentials(prisma, "nobody@example.com", "whatever")).toBeNull();
  });
});

describe("linkInstallation / listInstallationsForAccount", () => {
  const installation: GithubInstallation = {
    id: 999,
    account: { login: "acme", type: "Organization" },
    repository_selection: "all",
  };

  it("links a new installation to the account", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await createAccount(prisma, "person@example.com", "correct horse battery");

    await linkInstallation(prisma, account.id, installation);
    const installations = await listInstallationsForAccount(prisma, account.id);

    expect(installations).toHaveLength(1);
    expect(installations[0]).toMatchObject({
      installationId: "999",
      accountId: account.id,
      targetLogin: "acme",
      targetType: "Organization",
      repositorySelection: "all",
    });
  });

  it("re-linking the same installationId updates the existing row instead of duplicating it", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await createAccount(prisma, "person@example.com", "correct horse battery");

    await linkInstallation(prisma, account.id, installation);
    await linkInstallation(prisma, account.id, { ...installation, repository_selection: "selected" });

    const installations = await listInstallationsForAccount(prisma, account.id);
    expect(installations).toHaveLength(1);
    expect(installations[0]?.repositorySelection).toBe("selected");
  });

  it("falls back to 'unknown' when GitHub reports no installation account (rare, e.g. a deleted org)", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await createAccount(prisma, "person@example.com", "correct horse battery");

    await linkInstallation(prisma, account.id, { ...installation, account: null });
    const installations = await listInstallationsForAccount(prisma, account.id);

    expect(installations[0]).toMatchObject({ targetLogin: "unknown", targetType: "unknown" });
  });
});

describe("getInstallationForAccount", () => {
  const installation: GithubInstallation = {
    id: 999,
    account: { login: "acme", type: "Organization" },
    repository_selection: "all",
  };

  it("returns the installation when it belongs to the given account", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await createAccount(prisma, "person@example.com", "correct horse battery");
    await linkInstallation(prisma, account.id, installation);

    const found = await getInstallationForAccount(prisma, account.id, "999");
    expect(found).toMatchObject({ installationId: "999", accountId: account.id });
  });

  it("returns null when the installation belongs to a different account", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const ownerAccount = await createAccount(prisma, "person@example.com", "correct horse battery");
    const otherAccount = await createAccount(prisma, "someone-else@example.com", "another password");
    await linkInstallation(prisma, ownerAccount.id, installation);

    expect(await getInstallationForAccount(prisma, otherAccount.id, "999")).toBeNull();
  });

  it("returns null for an unknown installationId", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await createAccount(prisma, "person@example.com", "correct horse battery");
    expect(await getInstallationForAccount(prisma, account.id, "does-not-exist")).toBeNull();
  });
});

describe("saveCoreApiKey", () => {
  it("persists the key on the installation row", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await createAccount(prisma, "person@example.com", "correct horse battery");
    await linkInstallation(prisma, account.id, {
      id: 999,
      account: { login: "acme", type: "Organization" },
      repository_selection: "all",
    });

    await saveCoreApiKey(prisma, "999", "carf_the-key");

    const found = await getInstallationForAccount(prisma, account.id, "999");
    expect(found?.coreApiKey).toBe("carf_the-key");
  });
});
