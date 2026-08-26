import { describe, expect, it } from "vitest";
import { ensureApiKeyForInstallation, type InstallationApiKeyPrismaClient } from "../../src/auth/installationApiKeyService.js";
import { hashApiKey } from "../../src/auth/apiKey.js";

class FakeInstallationApiKeyPrismaClient implements InstallationApiKeyPrismaClient {
  rows = new Map<string, { id: string; installationId: string; keyHash: string }>();
  private nextId = 1;

  installationApiKey = {
    findUnique: async (args: { where: { installationId: string } }) =>
      this.rows.get(args.where.installationId) ?? null,
    create: async (args: { data: { installationId: string; keyHash: string } }) => {
      const row = { id: `key-${this.nextId++}`, ...args.data };
      this.rows.set(args.data.installationId, row);
      return row;
    },
  };
}

describe("ensureApiKeyForInstallation", () => {
  it("creates a new key and returns its plaintext when none exists yet", async () => {
    const prisma = new FakeInstallationApiKeyPrismaClient();
    const result = await ensureApiKeyForInstallation(prisma, "inst-1");

    expect(result.created).toBe(true);
    expect(result.plaintextKey).toBeDefined();
    expect(prisma.rows.get("inst-1")?.keyHash).toBe(hashApiKey(result.plaintextKey!));
  });

  it("is idempotent -- a second call for the same installation doesn't create another key or return a plaintext", async () => {
    const prisma = new FakeInstallationApiKeyPrismaClient();
    const first = await ensureApiKeyForInstallation(prisma, "inst-1");
    const second = await ensureApiKeyForInstallation(prisma, "inst-1");

    expect(second).toEqual({ created: false });
    expect(prisma.rows.get("inst-1")?.keyHash).toBe(hashApiKey(first.plaintextKey!));
  });

  it("creates independent keys for different installations", async () => {
    const prisma = new FakeInstallationApiKeyPrismaClient();
    const a = await ensureApiKeyForInstallation(prisma, "inst-a");
    const b = await ensureApiKeyForInstallation(prisma, "inst-b");

    expect(a.plaintextKey).not.toBe(b.plaintextKey);
    expect(prisma.rows.size).toBe(2);
  });
});
