// Local dev/testing seed data for the Phase 2 persistence layer (#10).
//
// Populates Commit, ChangeVector, Threshold, and EvaluationLog with a handful of
// synthetic rows so `npx prisma db seed` gives you something to poke at without
// needing a real webhook delivery. Safe to run repeatedly: it clears the four
// tables first (in FK-safe order) before inserting fresh rows.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedCommit {
  owner: string;
  repo: string;
  sha: string;
  baseSha: string;
  installationId: string | null;
  vector: {
    infra: number;
    dependency: number;
    config: number;
    code: number;
    codeComplexity: number;
  };
  threshold: {
    finalThreshold: number;
    finalWindow: number;
  };
}

const SEED_COMMITS: SeedCommit[] = [
  {
    owner: "acme-corp",
    repo: "payments-service",
    sha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    baseSha: "0000000000000000000000000000000000000a",
    installationId: "1001",
    vector: { infra: 0.1, dependency: 0.0, config: 0.2, code: 0.6, codeComplexity: 0.3 },
    threshold: { finalThreshold: 0.35, finalWindow: 900 },
  },
  {
    owner: "acme-corp",
    repo: "payments-service",
    sha: "b2c3d4e5f60718293a4b5c6d7e8f90123456789a",
    baseSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    installationId: "1001",
    vector: { infra: 0.7, dependency: 0.1, config: 0.4, code: 0.2, codeComplexity: 0.1 },
    threshold: { finalThreshold: 0.55, finalWindow: 1800 },
  },
  {
    owner: "acme-corp",
    repo: "web-frontend",
    sha: "c3d4e5f60718293a4b5c6d7e8f90123456789ab",
    baseSha: "b2c3d4e5f60718293a4b5c6d7e8f90123456789a",
    installationId: "1002",
    vector: { infra: 0.0, dependency: 0.3, config: 0.1, code: 0.8, codeComplexity: 0.5 },
    threshold: { finalThreshold: 0.4, finalWindow: 1200 },
  },
  {
    owner: "acme-corp",
    repo: "web-frontend",
    sha: "d4e5f60718293a4b5c6d7e8f90123456789abcd",
    baseSha: "c3d4e5f60718293a4b5c6d7e8f90123456789ab",
    installationId: "1002",
    vector: { infra: 0.05, dependency: 0.9, config: 0.05, code: 0.1, codeComplexity: 0.05 },
    threshold: { finalThreshold: 0.6, finalWindow: 2400 },
  },
  {
    owner: "beta-labs",
    repo: "infra-terraform",
    sha: "e5f60718293a4b5c6d7e8f90123456789abcdef",
    baseSha: "d4e5f60718293a4b5c6d7e8f90123456789abcd",
    installationId: "2001",
    vector: { infra: 0.95, dependency: 0.0, config: 0.6, code: 0.0, codeComplexity: 0.0 },
    threshold: { finalThreshold: 0.8, finalWindow: 3600 },
  },
  {
    owner: "beta-labs",
    repo: "infra-terraform",
    sha: "f60718293a4b5c6d7e8f90123456789abcdef01",
    baseSha: "e5f60718293a4b5c6d7e8f90123456789abcdef",
    installationId: "2001",
    vector: { infra: 0.4, dependency: 0.0, config: 0.9, code: 0.1, codeComplexity: 0.0 },
    threshold: { finalThreshold: 0.5, finalWindow: 1500 },
  },
  {
    owner: "beta-labs",
    repo: "data-pipeline",
    sha: "0718293a4b5c6d7e8f90123456789abcdef0123",
    baseSha: "f60718293a4b5c6d7e8f90123456789abcdef01",
    installationId: null,
    vector: { infra: 0.15, dependency: 0.2, config: 0.15, code: 0.5, codeComplexity: 0.65 },
    threshold: { finalThreshold: 0.45, finalWindow: 1000 },
  },
];

const SEED_EVALUATION_LOGS: Array<{
  commitSha: string;
  condition: "baseline" | "carf";
  outcome: "rollback" | "pass";
  mttrMs: number | null;
}> = [
  { commitSha: SEED_COMMITS[0].sha, condition: "baseline", outcome: "rollback", mttrMs: 480000 },
  { commitSha: SEED_COMMITS[0].sha, condition: "carf", outcome: "rollback", mttrMs: 90000 },
  { commitSha: SEED_COMMITS[1].sha, condition: "baseline", outcome: "pass", mttrMs: null },
  { commitSha: SEED_COMMITS[2].sha, condition: "carf", outcome: "pass", mttrMs: null },
  { commitSha: SEED_COMMITS[4].sha, condition: "baseline", outcome: "rollback", mttrMs: 720000 },
  { commitSha: SEED_COMMITS[4].sha, condition: "carf", outcome: "rollback", mttrMs: 60000 },
];

async function main(): Promise<void> {
  // Clear in FK-safe order: children before the Commit rows they point at.
  // EvaluationLog has no FK relation to Commit, so it can go in any order.
  await prisma.evaluationLog.deleteMany();
  await prisma.threshold.deleteMany();
  await prisma.changeVector.deleteMany();
  await prisma.commit.deleteMany();

  for (const seedCommit of SEED_COMMITS) {
    await prisma.commit.create({
      data: {
        owner: seedCommit.owner,
        repo: seedCommit.repo,
        sha: seedCommit.sha,
        baseSha: seedCommit.baseSha,
        installationId: seedCommit.installationId,
        changeVector: { create: seedCommit.vector },
        threshold: { create: seedCommit.threshold },
      },
    });
  }

  await prisma.evaluationLog.createMany({ data: SEED_EVALUATION_LOGS });

  console.log(
    `Seeded ${SEED_COMMITS.length} commits (with change vectors + thresholds) and ` +
      `${SEED_EVALUATION_LOGS.length} evaluation log rows.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
