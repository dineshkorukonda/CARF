import { describe, expect, it } from "vitest";
import { acquireLock, releaseLock, renewLock, type StandaloneLoopLockPrismaClient } from "../../src/adapters/standaloneLoopLock.js";

interface LockRow {
  owner: string;
  repo: string;
  sha: string;
  heartbeatAt: Date;
}

function key(owner: string, repo: string, sha: string): string {
  return `${owner}/${repo}@${sha}`;
}

class FakeLockPrismaClient implements StandaloneLoopLockPrismaClient {
  rows = new Map<string, LockRow>();

  standaloneLoopLock = {
    create: async (args: { data: { owner: string; repo: string; sha: string } }) => {
      const k = key(args.data.owner, args.data.repo, args.data.sha);
      if (this.rows.has(k)) {
        throw { code: "P2002" };
      }
      this.rows.set(k, { ...args.data, heartbeatAt: new Date() });
      return this.rows.get(k);
    },
    deleteMany: async (args: {
      where: { owner: string; repo: string; sha: string; heartbeatAt?: { lt: Date } };
    }) => {
      const k = key(args.where.owner, args.where.repo, args.where.sha);
      const row = this.rows.get(k);
      if (!row) return { count: 0 };
      if (args.where.heartbeatAt && !(row.heartbeatAt < args.where.heartbeatAt.lt)) {
        return { count: 0 };
      }
      this.rows.delete(k);
      return { count: 1 };
    },
    updateMany: async (args: {
      where: { owner: string; repo: string; sha: string };
      data: { heartbeatAt: Date };
    }) => {
      const k = key(args.where.owner, args.where.repo, args.where.sha);
      const row = this.rows.get(k);
      if (!row) return { count: 0 };
      row.heartbeatAt = args.data.heartbeatAt;
      return { count: 1 };
    },
  };
}

describe("acquireLock / renewLock / releaseLock", () => {
  it("acquires a lock that doesn't exist yet", async () => {
    const prisma = new FakeLockPrismaClient();
    await expect(acquireLock(prisma, "acme", "widgets", "sha1")).resolves.toBe(true);
  });

  it("fails to acquire a lock that's held and not stale", async () => {
    const prisma = new FakeLockPrismaClient();
    await acquireLock(prisma, "acme", "widgets", "sha1");
    await expect(acquireLock(prisma, "acme", "widgets", "sha1", 60_000)).resolves.toBe(false);
  });

  it("reclaims a lock whose heartbeat is older than the TTL", async () => {
    const prisma = new FakeLockPrismaClient();
    await acquireLock(prisma, "acme", "widgets", "sha1");
    const row = prisma.rows.get("acme/widgets@sha1")!;
    row.heartbeatAt = new Date(Date.now() - 120_000); // 2 minutes old

    await expect(acquireLock(prisma, "acme", "widgets", "sha1", 60_000)).resolves.toBe(true);
  });

  it("renewLock updates the heartbeat so the lock is no longer stale", async () => {
    const prisma = new FakeLockPrismaClient();
    await acquireLock(prisma, "acme", "widgets", "sha1");
    const row = prisma.rows.get("acme/widgets@sha1")!;
    row.heartbeatAt = new Date(Date.now() - 120_000);

    await renewLock(prisma, "acme", "widgets", "sha1");

    await expect(acquireLock(prisma, "acme", "widgets", "sha1", 60_000)).resolves.toBe(false);
  });

  it("releaseLock lets a subsequent acquire succeed immediately", async () => {
    const prisma = new FakeLockPrismaClient();
    await acquireLock(prisma, "acme", "widgets", "sha1");
    await releaseLock(prisma, "acme", "widgets", "sha1");

    await expect(acquireLock(prisma, "acme", "widgets", "sha1")).resolves.toBe(true);
  });

  it("renewLock and releaseLock are no-ops if the lock is already gone", async () => {
    const prisma = new FakeLockPrismaClient();
    await expect(renewLock(prisma, "acme", "widgets", "sha1")).resolves.toBeUndefined();
    await expect(releaseLock(prisma, "acme", "widgets", "sha1")).resolves.toBeUndefined();
  });

  it("propagates a non-unique-constraint error from create rather than treating it as contention", async () => {
    const prisma = new FakeLockPrismaClient();
    prisma.standaloneLoopLock.create = async () => {
      throw new Error("connection lost");
    };
    await expect(acquireLock(prisma, "acme", "widgets", "sha1")).rejects.toThrow("connection lost");
  });
});
