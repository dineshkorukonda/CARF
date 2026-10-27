import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, it } from "vitest";

it.skipIf(!process.env.DATABASE_URL)("isolates identical SHAs in two repositories in the same installation", async () => {
  const prisma = new PrismaClient();
  const installationId = `audit-${randomUUID()}`;
  try {
    const rows = [];
    for (const repo of ["one", "two"]) rows.push(await prisma.rolloutOutcome.upsert({
      where: { installationId_owner_repo_commitSha: { installationId, owner: "test", repo, commitSha: "same" } },
      create: { installationId, owner: "test", repo, commitSha: "same", threshold: 0.05, window: 60 }, update: {},
    }));
    expect(rows[0]!.id).not.toBe(rows[1]!.id);
    await prisma.rolloutOutcome.update({ where: { id: rows[0]!.id }, data: { status: "FAILED" } });
    expect((await prisma.rolloutOutcome.findUniqueOrThrow({ where: { id: rows[1]!.id } })).status).toBe("PENDING");
  } finally {
    await prisma.rolloutOutcome.deleteMany({ where: { installationId } });
    await prisma.$disconnect();
  }
});
