// Exercises StandaloneLoopLock's concurrency guarantees against a real Postgres unique
// constraint -- an in-memory fake can't meaningfully test a real race between two DB
// clients, which is the entire point of issue #56 (replacing a process-local Set with a
// durable, multi-instance-safe lock). Skipped without DATABASE_URL, same pattern as
// test/db/crud.test.ts.

import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { acquireLock, releaseLock, renewLock } from "../../src/adapters/standaloneLoopLock.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("StandaloneLoopLock against a live Postgres database", () => {
  // Two separate PrismaClient instances stand in for two core-api instances.
  const instanceA = new PrismaClient();
  const instanceB = new PrismaClient();
  const owner = "lock-test-owner";
  const repo = "lock-test-repo";

  afterEach(async () => {
    await instanceA.standaloneLoopLock.deleteMany({ where: { owner, repo } });
  });

  afterAll(async () => {
    await instanceA.standaloneLoopLock.deleteMany({ where: { owner, repo } }).catch(() => undefined);
    await instanceA.$disconnect();
    await instanceB.$disconnect();
  });

  it("only lets one of two concurrently-racing instances acquire the same lock", async () => {
    const sha = "concurrent-sha";

    const [resultA, resultB] = await Promise.all([
      acquireLock(instanceA, owner, repo, sha),
      acquireLock(instanceB, owner, repo, sha),
    ]);

    expect([resultA, resultB].filter(Boolean)).toHaveLength(1);
  });

  it("lets a second instance reclaim a lock whose holder crashed (stale heartbeat, short TTL)", async () => {
    const sha = "stale-sha";
    const ttlMs = 100;

    await acquireLock(instanceA, owner, repo, sha, ttlMs);
    await new Promise((resolve) => setTimeout(resolve, ttlMs + 50));

    await expect(acquireLock(instanceB, owner, repo, sha, ttlMs)).resolves.toBe(true);
  });

  it("a renewed heartbeat prevents reclamation within the TTL", async () => {
    const sha = "renewed-sha";
    const ttlMs = 200;

    await acquireLock(instanceA, owner, repo, sha, ttlMs);
    await new Promise((resolve) => setTimeout(resolve, ttlMs / 2));
    await renewLock(instanceA, owner, repo, sha);
    await new Promise((resolve) => setTimeout(resolve, ttlMs / 2 + 20));

    // Total elapsed since acquire > ttlMs, but heartbeat was renewed at the halfway
    // point, so it's only ~ttlMs/2 + 20ms stale relative to the renewal -- not reclaimable.
    await expect(acquireLock(instanceB, owner, repo, sha, ttlMs)).resolves.toBe(false);
  });

  it("release lets a different instance acquire immediately", async () => {
    const sha = "released-sha";

    await acquireLock(instanceA, owner, repo, sha);
    await releaseLock(instanceA, owner, repo, sha);

    await expect(acquireLock(instanceB, owner, repo, sha)).resolves.toBe(true);
  });
});
