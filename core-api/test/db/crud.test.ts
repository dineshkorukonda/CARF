// Exercises the Prisma models added for #10 (Commit, ChangeVector, Threshold) end to
// end against a real Postgres database: create -> read back joined -> delete.
//
// This requires a reachable Postgres instance at DATABASE_URL (run
// `npx prisma migrate dev` against it first). It is intentionally skipped rather than
// mocked when DATABASE_URL isn't set, so CI/sandboxes without a live DB don't fail —
// see core-api CLAUDE.md: classifier tests stay network/DB-free, but this is the one
// suite whose entire point is verifying real persistence.

import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("Prisma CRUD: Commit -> ChangeVector -> Threshold", () => {
  const prisma = new PrismaClient();
  const owner = "crud-test-owner";
  const repo = "crud-test-repo";
  const sha = "crud-test-sha-0123456789abcdef0123456789abcdef01234567";

  afterAll(async () => {
    // Best-effort cleanup in case an assertion failed before the test's own delete ran.
    await prisma.commit.deleteMany({ where: { owner, repo } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("creates a Commit, ChangeVector, and Threshold, reads them back joined, then deletes", async () => {
    const created = await prisma.commit.create({
      data: {
        owner,
        repo,
        sha,
        baseSha: "0000000000000000000000000000000000000a",
        installationId: "test-installation",
        changeVector: {
          create: {
            infra: 0.2,
            dependency: 0.1,
            config: 0.3,
            code: 0.5,
            codeComplexity: 0.4,
          },
        },
        threshold: {
          create: {
            finalThreshold: 0.42,
            finalWindow: 1200,
          },
        },
      },
    });

    expect(created.id).toBeTruthy();

    const joined = await prisma.commit.findUniqueOrThrow({
      where: { id: created.id },
      include: { changeVector: true, threshold: true },
    });

    expect(joined.owner).toBe(owner);
    expect(joined.repo).toBe(repo);
    expect(joined.sha).toBe(sha);
    expect(joined.changeVector).not.toBeNull();
    expect(joined.changeVector?.infra).toBeCloseTo(0.2);
    expect(joined.changeVector?.codeComplexity).toBeCloseTo(0.4);
    expect(joined.threshold).not.toBeNull();
    expect(joined.threshold?.finalThreshold).toBeCloseTo(0.42);
    expect(joined.threshold?.finalWindow).toBe(1200);

    // Deleting the Commit cascades to ChangeVector/Threshold (onDelete: Cascade).
    await prisma.commit.delete({ where: { id: created.id } });

    const afterDelete = await prisma.commit.findUnique({ where: { id: created.id } });
    expect(afterDelete).toBeNull();

    const orphanedVector = await prisma.changeVector.findUnique({
      where: { commitId: created.id },
    });
    expect(orphanedVector).toBeNull();

    const orphanedThreshold = await prisma.threshold.findUnique({
      where: { commitId: created.id },
    });
    expect(orphanedThreshold).toBeNull();
  });
});

describe.skipIf(hasDatabase)("Prisma CRUD (skipped, no DATABASE_URL)", () => {
  it("is skipped in environments without a live Postgres database", () => {
    expect(hasDatabase).toBe(false);
  });
});
