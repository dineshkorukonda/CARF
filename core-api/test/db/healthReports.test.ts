import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { expect, it } from "vitest";
import { registerReportRoute } from "../../src/routes/report.js";

it.skipIf(!process.env.DATABASE_URL)("persists report verdicts against PostgreSQL without changing deployment outcomes", async () => {
  const prisma = new PrismaClient();
  const sha = randomUUID();
  const app = Fastify();
  let commitId: string | undefined;
  try {
    const commit = await prisma.commit.create({ data: { owner: "report-test", repo: "app", sha, baseSha: "base",
      threshold: { create: { finalThreshold: 0.05, finalWindow: 60 } } } });
    commitId = commit.id;
    await registerReportRoute(app, { prismaClient: prisma });
    const response = await app.inject({ method: "POST", url: "/v1/report", payload: { commit: sha, errorRate: 0.2, durationMs: 1234 } });
    expect(response.statusCode).toBe(200);
    expect(await prisma.healthReport.findFirst({ where: { commitId } })).toMatchObject({ action: "rollback", durationMs: 1234, errorRate: 0.2 });
    expect(await prisma.rolloutOutcome.count({ where: { commitId } })).toBe(0);
  } finally {
    await app.close();
    if (commitId) await prisma.commit.delete({ where: { id: commitId } });
    await prisma.$disconnect();
  }
});
