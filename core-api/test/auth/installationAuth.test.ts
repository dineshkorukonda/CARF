import { describe, expect, it } from "vitest";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../../src/auth/installationAuth.js";
import { hashApiKey } from "../../src/auth/apiKey.js";

function fakePrisma(keyToInstallation: Record<string, string>): InstallationAuthPrismaClient {
  return {
    installationApiKey: {
      findUnique: async (args: { where: { keyHash: string } }) => {
        const installationId = Object.entries(keyToInstallation).find(
          ([plaintext]) => hashApiKey(plaintext) === args.where.keyHash
        )?.[1];
        return installationId ? { installationId } : null;
      },
    },
  };
}

describe("resolveInstallationFromAuthHeader", () => {
  it("resolves the installationId for a valid Bearer key", async () => {
    const prisma = fakePrisma({ "carf_valid-key": "inst-1" });
    expect(await resolveInstallationFromAuthHeader(prisma, "Bearer carf_valid-key")).toBe("inst-1");
  });

  it("returns null for an unrecognized key", async () => {
    const prisma = fakePrisma({ "carf_valid-key": "inst-1" });
    expect(await resolveInstallationFromAuthHeader(prisma, "Bearer carf_wrong-key")).toBeNull();
  });

  it("returns null when the header is missing", async () => {
    const prisma = fakePrisma({});
    expect(await resolveInstallationFromAuthHeader(prisma, undefined)).toBeNull();
  });

  it("returns null for a non-Bearer scheme", async () => {
    const prisma = fakePrisma({ "carf_valid-key": "inst-1" });
    expect(await resolveInstallationFromAuthHeader(prisma, "Basic carf_valid-key")).toBeNull();
  });

  it("returns null for 'Bearer ' with no token", async () => {
    const prisma = fakePrisma({});
    expect(await resolveInstallationFromAuthHeader(prisma, "Bearer ")).toBeNull();
  });
});
