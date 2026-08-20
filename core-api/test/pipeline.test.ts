// Unit tests use an in-memory fake PrismaClient (no network/DB — see core-api/CLAUDE.md's
// "external calls must be mockable" convention applied here to the DB seam) to exercise
// control flow: empty-changeset guard, no-signal guard, upsert wiring, idempotency of the
// *in-process* upsert calls, and the threshold math handoff.
//
// The live-DB describe block at the bottom exercises the real Prisma client against a
// real Postgres, mirroring the describe.skipIf(!process.env.DATABASE_URL) pattern in
// test/db/crud.test.ts, so it's skipped in environments without a reachable database.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  EmptyChangeSetError,
  InvalidRepoSlugError,
  NoSignalError,
  processCommit,
  type PipelinePrismaClient,
} from "../src/pipeline.js";
import { DEFAULT_CONFIG } from "../src/threshold/engine.js";

// ---------------------------------------------------------------------------
// In-memory fake Prisma client
// ---------------------------------------------------------------------------

interface FakeCommitRow {
  id: string;
  owner: string;
  repo: string;
  sha: string;
  baseSha: string;
}

interface FakeChangeVectorRow {
  commitId: string;
  infra: number;
  dependency: number;
  config: number;
  code: number;
  codeComplexity: number;
}

interface FakeThresholdRow {
  commitId: string;
  finalThreshold: number;
  finalWindow: number;
}

class FakePrismaClient implements PipelinePrismaClient {
  commits = new Map<string, FakeCommitRow>();
  changeVectors = new Map<string, FakeChangeVectorRow>();
  thresholds = new Map<string, FakeThresholdRow>();
  commitUpsertCalls = 0;
  changeVectorUpsertCalls = 0;
  thresholdUpsertCalls = 0;

  commit = {
    upsert: async (args: {
      where: { owner_repo_sha: { owner: string; repo: string; sha: string } };
      create: { owner: string; repo: string; sha: string; baseSha: string };
      update: Record<string, never>;
    }) => {
      this.commitUpsertCalls += 1;
      const key = `${args.where.owner_repo_sha.owner}/${args.where.owner_repo_sha.repo}/${args.where.owner_repo_sha.sha}`;
      const existing = this.commits.get(key);
      if (existing) return existing;
      const row: FakeCommitRow = { id: key, ...args.create };
      this.commits.set(key, row);
      return row;
    },
  };

  changeVector = {
    upsert: async (args: {
      where: { commitId: string };
      create: FakeChangeVectorRow;
      update: Omit<FakeChangeVectorRow, "commitId">;
    }) => {
      this.changeVectorUpsertCalls += 1;
      const row: FakeChangeVectorRow = { commitId: args.where.commitId, ...args.update };
      this.changeVectors.set(args.where.commitId, row);
      return row;
    },
  };

  threshold = {
    upsert: async (args: {
      where: { commitId: string };
      create: FakeThresholdRow;
      update: Omit<FakeThresholdRow, "commitId">;
    }) => {
      this.thresholdUpsertCalls += 1;
      const row: FakeThresholdRow = { commitId: args.where.commitId, ...args.update };
      this.thresholds.set(args.where.commitId, row);
      return row;
    },
  };
}

const DOCKERFILE = { path: "Dockerfile", before: "", after: "FROM node:20\n" };
const PACKAGE_JSON = { path: "package.json", before: "{}\n", after: '{"name":"x"}\n' };
const CONFIG_YAML = { path: "config.yaml", before: "a: 1\n", after: "a: 2\n" };
const CODE_TS = { path: "src/foo.ts", before: "export const a = 1;\n", after: "export const a = 2;\nexport const b = 3;\n" };
const README = { path: "README.md", before: "old\n", after: "new\n" };

describe("processCommit", () => {
  let fake: FakePrismaClient;

  beforeEach(() => {
    fake = new FakePrismaClient();
  });

  it("throws EmptyChangeSetError when changedFiles is empty", async () => {
    await expect(processCommit("sha1", "acme/widgets", [], { prismaClient: fake })).rejects.toThrow(
      EmptyChangeSetError
    );
  });

  it("does not touch the database when changedFiles is empty", async () => {
    await expect(processCommit("sha1", "acme/widgets", [], { prismaClient: fake })).rejects.toThrow();
    expect(fake.commitUpsertCalls).toBe(0);
  });

  it("throws InvalidRepoSlugError when repo isn't in owner/repo form", async () => {
    await expect(
      processCommit("sha1", "widgets-no-owner", [CODE_TS], { prismaClient: fake })
    ).rejects.toThrow(InvalidRepoSlugError);
  });

  it("throws NoSignalError when classifyCommit() returns null, but still records the Commit row", async () => {
    // README.md alone classifies as "unclassified" -> Tier1Result.totalFiles === 0 ->
    // classifyCommit() returns null -> per CLAUDE.md this means "skip threshold
    // computation." Documented decision (see pipeline.ts): the Commit row is still
    // persisted (we know a commit happened), but ChangeVector/Threshold are skipped and
    // a typed NoSignalError is thrown so callers can distinguish this from a real failure.
    await expect(
      processCommit("sha-no-signal", "acme/widgets", [README], { prismaClient: fake })
    ).rejects.toThrow(NoSignalError);

    expect(fake.commitUpsertCalls).toBe(1);
    expect(fake.changeVectorUpsertCalls).toBe(0);
    expect(fake.thresholdUpsertCalls).toBe(0);
  });

  it("persists Commit, ChangeVector, and Threshold and returns the ThresholdResult", async () => {
    const result = await processCommit("sha-ok", "acme/widgets", [DOCKERFILE, CODE_TS], {
      prismaClient: fake,
    });

    expect(fake.commitUpsertCalls).toBe(1);
    expect(fake.changeVectorUpsertCalls).toBe(1);
    expect(fake.thresholdUpsertCalls).toBe(1);

    const commitRow = [...fake.commits.values()][0]!;
    const vectorRow = fake.changeVectors.get(commitRow.id);
    const thresholdRow = fake.thresholds.get(commitRow.id);

    expect(vectorRow).toBeDefined();
    expect(thresholdRow).toBeDefined();
    expect(thresholdRow?.finalThreshold).toBe(result.finalThreshold);
    expect(thresholdRow?.finalWindow).toBe(result.finalWindow);
    expect(result.activeTypes.length).toBeGreaterThan(0);
  });

  it("splits the 'owner/repo' slug and persists owner/repo separately on the Commit row", async () => {
    await processCommit("sha-split", "my-org/my-repo", [CODE_TS], { prismaClient: fake });

    const commitRow = [...fake.commits.values()][0]!;
    expect(commitRow.owner).toBe("my-org");
    expect(commitRow.repo).toBe("my-repo");
    expect(commitRow.sha).toBe("sha-split");
  });

  it("is idempotent: calling twice with the same sha upserts rather than duplicating rows", async () => {
    await processCommit("sha-dup", "acme/widgets", [PACKAGE_JSON, CONFIG_YAML], { prismaClient: fake });
    await processCommit("sha-dup", "acme/widgets", [PACKAGE_JSON, CONFIG_YAML], { prismaClient: fake });

    expect(fake.commits.size).toBe(1);
    expect(fake.changeVectors.size).toBe(1);
    expect(fake.thresholds.size).toBe(1);
    expect(fake.commitUpsertCalls).toBe(2);
    expect(fake.changeVectorUpsertCalls).toBe(2);
    expect(fake.thresholdUpsertCalls).toBe(2);
  });

  it("computes the same ThresholdResult that computeThreshold() would given the classified vector (uses DEFAULT_CONFIG by default)", async () => {
    const result = await processCommit("sha-math", "acme/widgets", [DOCKERFILE], { prismaClient: fake });

    // Dockerfile alone -> infra=1, everything else 0 -> only "infra" active.
    // contribution = DEFAULT_CONFIG.baseThreshold.infra * (1 - decay * 1)
    const expectedThreshold =
      DEFAULT_CONFIG.baseThreshold.infra * (1 - DEFAULT_CONFIG.decay * 1);
    const expectedWindow = DEFAULT_CONFIG.baseWindow.infra * (1 - DEFAULT_CONFIG.decay * 1);
    expect(result.finalThreshold).toBeCloseTo(expectedThreshold, 10);
    expect(result.finalWindow).toBeCloseTo(expectedWindow, 10);
    expect(result.activeTypes).toEqual(["infra"]);
  });

  it("accepts a custom ThresholdConfig override", async () => {
    const customConfig = {
      baseThreshold: { infra: 1, dependency: 1, config: 1, code: 1 },
      baseWindow: { infra: 10, dependency: 10, config: 10, code: 10 },
      decay: 0,
      complexityDecay: 0,
    };
    const result = await processCommit("sha-custom", "acme/widgets", [DOCKERFILE], {
      prismaClient: fake,
      thresholdConfig: customConfig,
    });

    expect(result.finalThreshold).toBe(1);
    expect(result.finalWindow).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Live-DB tests — real Postgres required, skipped otherwise (see test/db/crud.test.ts).
// ---------------------------------------------------------------------------

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("processCommit against a live Postgres database", () => {
  const prisma = new PrismaClient();
  const owner = "pipeline-test-owner";
  const repo = "pipeline-test-repo";
  const repoSlug = `${owner}/${repo}`;

  afterAll(async () => {
    await prisma.commit.deleteMany({ where: { owner, repo } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.commit.deleteMany({ where: { owner, repo } });
  });

  it("persists a Threshold row in the database for the processed commit", async () => {
    const sha = "live-e2e-sha";

    const result = await processCommit(sha, repoSlug, [DOCKERFILE, CODE_TS]);

    const commitRow = await prisma.commit.findUniqueOrThrow({
      where: { owner_repo_sha: { owner, repo, sha } },
      include: { changeVector: true, threshold: true },
    });

    expect(commitRow.changeVector).not.toBeNull();
    expect(commitRow.threshold).not.toBeNull();
    expect(commitRow.threshold?.finalThreshold).toBeCloseTo(result.finalThreshold, 10);
    expect(commitRow.threshold?.finalWindow).toBeCloseTo(result.finalWindow, 10);
  });

  it("is idempotent against a live database: reprocessing the same sha upserts, not duplicates", async () => {
    const sha = "live-idempotent-sha";

    await processCommit(sha, repoSlug, [PACKAGE_JSON, CONFIG_YAML]);
    await processCommit(sha, repoSlug, [PACKAGE_JSON, CONFIG_YAML]);

    const commitCount = await prisma.commit.count({ where: { owner, repo, sha } });
    const vectorCount = await prisma.changeVector.count({
      where: { commit: { owner, repo, sha } },
    });
    const thresholdCount = await prisma.threshold.count({
      where: { commit: { owner, repo, sha } },
    });

    expect(commitCount).toBe(1);
    expect(vectorCount).toBe(1);
    expect(thresholdCount).toBe(1);
  });

  it("records the Commit row but no ChangeVector/Threshold when classifyCommit() returns null", async () => {
    const sha = "live-no-signal-sha";

    await expect(processCommit(sha, repoSlug, [README])).rejects.toThrow(NoSignalError);

    const commitRow = await prisma.commit.findUniqueOrThrow({
      where: { owner_repo_sha: { owner, repo, sha } },
      include: { changeVector: true, threshold: true },
    });
    expect(commitRow.changeVector).toBeNull();
    expect(commitRow.threshold).toBeNull();
  });
});
