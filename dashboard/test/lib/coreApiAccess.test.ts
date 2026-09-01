import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardPrismaClient, InstallationRow } from "../../src/lib/accountService";

const signGithubAppJwt = vi.fn();
const fetchInstallationApiKey = vi.fn();

vi.mock("../../src/config/env", () => ({
  env: {
    githubAppId: () => "app-id-123",
    githubAppPrivateKey: () => "fake-private-key",
    coreApiBaseUrl: () => "http://core-api.test",
  },
}));

vi.mock("../../src/adapters/github/appInstallClient", () => ({
  signGithubAppJwt: (...args: unknown[]) => signGithubAppJwt(...args),
}));

vi.mock("../../src/adapters/coreApi/client", () => ({
  fetchInstallationApiKey: (...args: unknown[]) => fetchInstallationApiKey(...args),
}));

const { ensureCoreApiKey } = await import("../../src/lib/coreApiAccess");

function installation(overrides: Partial<InstallationRow> = {}): InstallationRow {
  return {
    id: "row-1",
    installationId: "55555",
    accountId: "account-1",
    targetLogin: "acme",
    targetType: "Organization",
    repositorySelection: "all",
    coreApiKey: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

/** Records only what ensureCoreApiKey actually uses: the installation update that caches
 *  the key. Same in-memory-fake convention as accountService.test.ts. */
function fakePrisma(): DashboardPrismaClient & { updates: Array<{ installationId: string; coreApiKey: string }> } {
  const updates: Array<{ installationId: string; coreApiKey: string }> = [];
  return {
    updates,
    account: {} as DashboardPrismaClient["account"],
    installation: {
      update: async (args: { where: { installationId: string }; data: { coreApiKey: string } }) => {
        updates.push({ installationId: args.where.installationId, coreApiKey: args.data.coreApiKey });
        return installation({ coreApiKey: args.data.coreApiKey });
      },
    } as unknown as DashboardPrismaClient["installation"],
  } as DashboardPrismaClient & { updates: typeof updates };
}

describe("ensureCoreApiKey", () => {
  beforeEach(() => {
    signGithubAppJwt.mockReset();
    fetchInstallationApiKey.mockReset();
    signGithubAppJwt.mockReturnValue("app-jwt");
  });

  it("returns the cached key without calling core-api or signing a JWT", async () => {
    const prisma = fakePrisma();

    const key = await ensureCoreApiKey(prisma, installation({ coreApiKey: "carf_cached_key" }));

    expect(key).toBe("carf_cached_key");
    expect(fetchInstallationApiKey).not.toHaveBeenCalled();
    expect(signGithubAppJwt).not.toHaveBeenCalled();
    expect(prisma.updates).toEqual([]);
  });

  it("fetches a fresh key when none is cached, proving App control with an App JWT", async () => {
    fetchInstallationApiKey.mockResolvedValue("carf_fresh_key");
    const prisma = fakePrisma();

    const key = await ensureCoreApiKey(prisma, installation({ coreApiKey: null }));

    expect(key).toBe("carf_fresh_key");
    expect(fetchInstallationApiKey).toHaveBeenCalledWith("http://core-api.test", "55555", "app-jwt");
  });

  // Without this write the key is re-minted on every status page load. core-api rotates a
  // new key on each issuance, so the previous one stops working -- see #64.
  it("caches the fetched key on the installation row", async () => {
    fetchInstallationApiKey.mockResolvedValue("carf_fresh_key");
    const prisma = fakePrisma();

    await ensureCoreApiKey(prisma, installation({ coreApiKey: null }));

    expect(prisma.updates).toEqual([{ installationId: "55555", coreApiKey: "carf_fresh_key" }]);
  });

  it("does not cache anything when core-api's key issuance fails", async () => {
    fetchInstallationApiKey.mockRejectedValue(new Error("core-api returned 403"));
    const prisma = fakePrisma();

    await expect(ensureCoreApiKey(prisma, installation({ coreApiKey: null }))).rejects.toThrow(
      "core-api returned 403"
    );
    expect(prisma.updates).toEqual([]);
  });

  // An empty string is falsy, so it must be treated as "not cached" rather than returned
  // as a usable key -- returning "" would send an unauthenticated request to core-api.
  it("treats an empty cached key as missing and fetches a real one", async () => {
    fetchInstallationApiKey.mockResolvedValue("carf_fresh_key");
    const prisma = fakePrisma();

    const key = await ensureCoreApiKey(prisma, installation({ coreApiKey: "" }));

    expect(key).toBe("carf_fresh_key");
    expect(fetchInstallationApiKey).toHaveBeenCalled();
  });
});
