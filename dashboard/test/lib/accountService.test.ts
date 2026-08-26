import { describe, expect, it } from "vitest";
import {
  getInstallationForAccount,
  linkInstallation,
  listInstallationsForAccount,
  saveCoreApiKey,
  upsertAccountFromGithubUser,
  type AccountRow,
  type DashboardPrismaClient,
  type InstallationRow,
} from "../../src/lib/accountService";
import type { GithubOAuthUser } from "../../src/adapters/github/oauthClient";
import type { GithubInstallation } from "../../src/adapters/github/appInstallClient";

class FakeDashboardPrismaClient implements DashboardPrismaClient {
  accounts = new Map<string, AccountRow>();
  installations = new Map<string, InstallationRow>();
  private nextId = 1;

  account = {
    upsert: async (args: {
      where: { githubUserId: string };
      create: { githubUserId: string; githubLogin: string; avatarUrl: string | null };
      update: { githubLogin: string; avatarUrl: string | null };
    }) => {
      const existing = [...this.accounts.values()].find((a) => a.githubUserId === args.where.githubUserId);
      if (existing) {
        const updated = { ...existing, ...args.update };
        this.accounts.set(existing.id, updated);
        return updated;
      }
      const row: AccountRow = { id: `account-${this.nextId++}`, ...args.create };
      this.accounts.set(row.id, row);
      return row;
    },
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

const githubUser: GithubOAuthUser = { id: 42, login: "octocat", avatar_url: "https://example.com/a.png" };

describe("upsertAccountFromGithubUser", () => {
  it("creates a new Account on first login", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await upsertAccountFromGithubUser(prisma, githubUser);
    expect(account).toMatchObject({ githubUserId: "42", githubLogin: "octocat" });
  });

  it("updates the same Account (not a duplicate) on a subsequent login with a changed login/avatar", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const first = await upsertAccountFromGithubUser(prisma, githubUser);
    const second = await upsertAccountFromGithubUser(prisma, { ...githubUser, login: "octocat-renamed" });

    expect(second.id).toBe(first.id);
    expect(second.githubLogin).toBe("octocat-renamed");
    expect(prisma.accounts.size).toBe(1);
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
    const account = await upsertAccountFromGithubUser(prisma, githubUser);

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
    const account = await upsertAccountFromGithubUser(prisma, githubUser);

    await linkInstallation(prisma, account.id, installation);
    await linkInstallation(prisma, account.id, { ...installation, repository_selection: "selected" });

    const installations = await listInstallationsForAccount(prisma, account.id);
    expect(installations).toHaveLength(1);
    expect(installations[0]?.repositorySelection).toBe("selected");
  });

  it("falls back to 'unknown' when GitHub reports no installation account (rare, e.g. a deleted org)", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await upsertAccountFromGithubUser(prisma, githubUser);

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
    const account = await upsertAccountFromGithubUser(prisma, githubUser);
    await linkInstallation(prisma, account.id, installation);

    const found = await getInstallationForAccount(prisma, account.id, "999");
    expect(found).toMatchObject({ installationId: "999", accountId: account.id });
  });

  it("returns null when the installation belongs to a different account", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const ownerAccount = await upsertAccountFromGithubUser(prisma, githubUser);
    const otherAccount = await upsertAccountFromGithubUser(prisma, { ...githubUser, id: 43, login: "someone-else" });
    await linkInstallation(prisma, ownerAccount.id, installation);

    expect(await getInstallationForAccount(prisma, otherAccount.id, "999")).toBeNull();
  });

  it("returns null for an unknown installationId", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await upsertAccountFromGithubUser(prisma, githubUser);
    expect(await getInstallationForAccount(prisma, account.id, "does-not-exist")).toBeNull();
  });
});

describe("saveCoreApiKey", () => {
  it("persists the key on the installation row", async () => {
    const prisma = new FakeDashboardPrismaClient();
    const account = await upsertAccountFromGithubUser(prisma, githubUser);
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
