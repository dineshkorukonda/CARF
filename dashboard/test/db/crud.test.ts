// Exercises the dashboard's Prisma models against a real Postgres database. Everything
// else in this package runs against in-memory fakes, which cannot catch a mistake that
// lives only in schema.prisma and the migration: a missing @unique, or an onDelete rule
// that doesn't cascade.
//
// Requires a reachable Postgres at DATABASE_URL with the migrations applied (run
// `npm run db:migrate:dev` first). Skipped rather than mocked when DATABASE_URL isn't set,
// so a sandbox without a live DB doesn't fail.

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("dashboard persistence: User -> Installation / Account", () => {
  const prisma = new PrismaClient();
  const suffix = randomBytes(6).toString("hex");
  const email = (label: string) => `db-test-${label}-${suffix}@example.com`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } }).catch(() => undefined);
    await prisma.installation.deleteMany({ where: { installationId: { contains: suffix } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("creates a User and reads it back", async () => {
    const created = await prisma.user.create({
      data: { email: email("basic"), name: "Basic User" },
    });

    const found = await prisma.user.findUnique({ where: { id: created.id } });

    expect(found?.email).toBe(email("basic"));
    expect(found?.name).toBe("Basic User");
    expect(found?.createdAt).toBeInstanceOf(Date);

    await prisma.user.delete({ where: { id: created.id } });
  });

  it("rejects a second User with the same email", async () => {
    const created = await prisma.user.create({
      data: { email: email("dupe"), name: "User 1" },
    });

    await expect(
      prisma.user.create({ data: { email: email("dupe"), name: "User 2" } })
    ).rejects.toThrow();

    await prisma.user.delete({ where: { id: created.id } });
  });

  it("links an Auth.js Account to a User and cascades on delete", async () => {
    const user = await prisma.user.create({
      data: { email: email("oauth"), name: "OAuth User" },
    });

    const account = await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "github",
        providerAccountId: `gh-${suffix}`,
      },
    });

    expect(account.providerAccountId).toBe(`gh-${suffix}`);

    await prisma.user.delete({ where: { id: user.id } });

    const orphans = await prisma.account.findMany({ where: { userId: user.id } });
    expect(orphans).toEqual([]);
  });

  it("cascades a User delete to its Installation rows", async () => {
    const user = await prisma.user.create({
      data: { email: email("cascade-install") },
    });
    await prisma.installation.create({
      data: {
        installationId: `inst-cascade-${suffix}`,
        userId: user.id,
        targetLogin: "acme",
        targetType: "Organization",
        repositorySelection: "all",
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    const orphans = await prisma.installation.findMany({ where: { userId: user.id } });
    expect(orphans).toEqual([]);
  });

  it("upserts an Installation idempotently on a repeated installationId", async () => {
    const user = await prisma.user.create({
      data: { email: email("upsert") },
    });
    const installationId = `inst-upsert-${suffix}`;
    const create = {
      installationId,
      userId: user.id,
      targetLogin: "acme",
      targetType: "Organization",
      repositorySelection: "all",
    };

    const first = await prisma.installation.upsert({
      where: { installationId },
      create,
      update: { targetLogin: "acme", targetType: "Organization", repositorySelection: "all" },
    });
    const second = await prisma.installation.upsert({
      where: { installationId },
      create,
      update: { targetLogin: "acme-renamed", targetType: "Organization", repositorySelection: "selected" },
    });

    expect(second.id).toBe(first.id);
    expect(second.targetLogin).toBe("acme-renamed");
    expect(await prisma.installation.count({ where: { installationId } })).toBe(1);

    await prisma.user.delete({ where: { id: user.id } });
  });

  it("stores a null coreApiKey until one is cached, then persists it", async () => {
    const user = await prisma.user.create({
      data: { email: email("apikey") },
    });
    const installationId = `inst-apikey-${suffix}`;
    const created = await prisma.installation.create({
      data: {
        installationId,
        userId: user.id,
        targetLogin: "acme",
        targetType: "Organization",
        repositorySelection: "all",
      },
    });

    expect(created.coreApiKey).toBeNull();

    const updated = await prisma.installation.update({
      where: { installationId },
      data: { coreApiKey: "carf_persisted_key" },
    });
    expect(updated.coreApiKey).toBe("carf_persisted_key");

    await prisma.user.delete({ where: { id: user.id } });
  });
});
