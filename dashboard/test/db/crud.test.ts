// Exercises the dashboard's Prisma models against a real Postgres database. Everything
// else in this package runs against in-memory fakes, which cannot catch a mistake that
// lives only in schema.prisma and the migration: a missing @unique, or an onDelete rule
// that doesn't cascade.
//
// Requires a reachable Postgres at DATABASE_URL with the migrations applied (run
// `npm run db:migrate:dev` first). Skipped rather than mocked when DATABASE_URL isn't set,
// so a sandbox without a live DB doesn't fail -- same convention and reasoning as
// core-api/test/db/crud.test.ts.
//
// .github/workflows/dashboard.yml already provides Postgres 16 and runs
// `prisma migrate deploy` before `npm test`, so these run for real in CI.

import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("dashboard persistence: Account -> Installation / PasswordResetToken", () => {
  const prisma = new PrismaClient();
  // Namespaced so a failed run's leftovers never collide with the next one.
  const suffix = randomBytes(6).toString("hex");
  const email = (label: string) => `db-test-${label}-${suffix}@example.com`;

  afterAll(async () => {
    // Best-effort cleanup in case an assertion failed before a test's own delete ran.
    await prisma.account.deleteMany({ where: { email: { contains: suffix } } }).catch(() => undefined);
    await prisma.installation.deleteMany({ where: { installationId: { contains: suffix } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("creates an Account and reads it back", async () => {
    const created = await prisma.account.create({
      data: { email: email("basic"), passwordHash: "$2a$12$notarealhash" },
    });

    const found = await prisma.account.findUnique({ where: { id: created.id } });

    expect(found?.email).toBe(email("basic"));
    expect(found?.createdAt).toBeInstanceOf(Date);

    await prisma.account.delete({ where: { id: created.id } });
  });

  // Account.email is @unique. accountService.createAccount also checks first, so without a
  // real database nothing proves the constraint itself is in the migration.
  it("rejects a second Account with the same email", async () => {
    const created = await prisma.account.create({
      data: { email: email("dupe"), passwordHash: "hash-1" },
    });

    await expect(
      prisma.account.create({ data: { email: email("dupe"), passwordHash: "hash-2" } })
    ).rejects.toThrow();

    await prisma.account.delete({ where: { id: created.id } });
  });

  it("rejects a second PasswordResetToken with the same tokenHash", async () => {
    const account = await prisma.account.create({
      data: { email: email("token-unique"), passwordHash: "hash" },
    });
    const tokenHash = createHash("sha256").update(`raw-${suffix}`).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({ data: { tokenHash, accountId: account.id, expiresAt } });

    await expect(
      prisma.passwordResetToken.create({ data: { tokenHash, accountId: account.id, expiresAt } })
    ).rejects.toThrow();

    await prisma.account.delete({ where: { id: account.id } });
  });

  // onDelete: Cascade lives only in the schema and the migration's FK definition. If it
  // regressed to the default, deleting an account would either fail or strand live reset
  // tokens pointing at a account that no longer exists.
  it("cascades an Account delete to its PasswordResetToken rows", async () => {
    const account = await prisma.account.create({
      data: { email: email("cascade-token"), passwordHash: "hash" },
    });
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: createHash("sha256").update(`cascade-${suffix}`).digest("hex"),
        accountId: account.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await prisma.account.delete({ where: { id: account.id } });

    const orphans = await prisma.passwordResetToken.findMany({ where: { accountId: account.id } });
    expect(orphans).toEqual([]);
  });

  it("cascades an Account delete to its Installation rows", async () => {
    const account = await prisma.account.create({
      data: { email: email("cascade-install"), passwordHash: "hash" },
    });
    await prisma.installation.create({
      data: {
        installationId: `inst-cascade-${suffix}`,
        accountId: account.id,
        targetLogin: "acme",
        targetType: "Organization",
        repositorySelection: "all",
      },
    });

    await prisma.account.delete({ where: { id: account.id } });

    const orphans = await prisma.installation.findMany({ where: { accountId: account.id } });
    expect(orphans).toEqual([]);
  });

  // linkInstallation upserts on installationId precisely because GitHub redelivers install
  // callbacks. The @unique that makes the upsert safe is a database-level guarantee.
  it("upserts an Installation idempotently on a repeated installationId", async () => {
    const account = await prisma.account.create({
      data: { email: email("upsert"), passwordHash: "hash" },
    });
    const installationId = `inst-upsert-${suffix}`;
    const create = {
      installationId,
      accountId: account.id,
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

    await prisma.account.delete({ where: { id: account.id } });
  });

  // The session-revocation fix depends on this column defaulting to 0 for existing rows and
  // on Prisma's atomic increment reaching the database, not just the in-memory fakes.
  it("defaults sessionVersion to 0 and increments it atomically", async () => {
    const created = await prisma.account.create({
      data: { email: email("session-version"), passwordHash: "hash" },
    });

    expect(created.sessionVersion).toBe(0);

    const bumped = await prisma.account.update({
      where: { id: created.id },
      data: { passwordHash: "new-hash", sessionVersion: { increment: 1 } },
    });
    expect(bumped.sessionVersion).toBe(1);

    await prisma.account.delete({ where: { id: created.id } });
  });

  it("stores a null coreApiKey until one is cached, then persists it", async () => {
    const account = await prisma.account.create({
      data: { email: email("apikey"), passwordHash: "hash" },
    });
    const installationId = `inst-apikey-${suffix}`;
    const created = await prisma.installation.create({
      data: {
        installationId,
        accountId: account.id,
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

    await prisma.account.delete({ where: { id: account.id } });
  });
});
