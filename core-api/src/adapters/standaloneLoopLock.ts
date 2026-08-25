/**
 * Durable replacement for webhookOrchestrator.ts's old in-memory `activeLoops` Set (issue
 * #56): guards against two core-api instances starting a concurrent Standalone rollback
 * loop for the same commit, backed by the `StandaloneLoopLock` table's
 * `@@unique([owner, repo, sha])` constraint rather than process memory.
 *
 * Acquisition never blocks/waits — a failed acquire means "another instance holds this
 * lock and it isn't stale," so the caller should just skip this delivery (GitHub will
 * redeliver later if needed, same as the old Set-based guard's behavior).
 *
 * Known limitation (inherent to any TTL/heartbeat lease, not specific to this
 * implementation): if the holding instance's heartbeat renewal is merely *delayed* past
 * the TTL (GC pause, event-loop congestion, a slow DB) rather than the holder actually
 * being dead, a second instance can reclaim the lock and start a second concurrent loop —
 * the exact double-kickoff this guard exists to prevent. The default TTL (60s) is a large
 * multiple of the default heartbeat interval (20s) specifically to make this rare in
 * practice, but a lease-based lock cannot rule it out entirely without fencing tokens
 * (each acquisition gets a monotonically increasing token; the loop checks it's still the
 * current token before performing rollback actions). That's a larger change than this
 * issue's scope — see issue #56's discussion.
 */

export const DEFAULT_LOCK_TTL_MS = 60_000;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 20_000;

/** Minimal seam over the subset of PrismaClient's API this module needs. */
export interface StandaloneLoopLockPrismaClient {
  standaloneLoopLock: {
    create(args: { data: { owner: string; repo: string; sha: string } }): Promise<unknown>;
    deleteMany(args: {
      where: { owner: string; repo: string; sha: string; heartbeatAt?: { lt: Date } };
    }): Promise<{ count: number }>;
    updateMany(args: {
      where: { owner: string; repo: string; sha: string };
      data: { heartbeatAt: Date };
    }): Promise<{ count: number }>;
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";
}

/**
 * Attempts to acquire the lock for (owner, repo, sha). Returns true if acquired (either
 * the row didn't exist, or it existed but its heartbeat was older than `ttlMs` and this
 * call successfully reclaimed it), false if another instance genuinely holds it.
 *
 * Reclaiming a stale lock is race-safe without raw SQL: `deleteMany`'s affected-row-count
 * is atomic per row, so if two instances race to reclaim the same stale lock, only one's
 * `deleteMany` actually deletes a row (count 1); the other sees count 0 and backs off. The
 * winner's subsequent `create` can still itself lose a race to a third instance that
 * created fresh between the delete and the create -- that `create` throwing P2002 is
 * treated as "someone else got it," not an error.
 */
export async function acquireLock(
  prisma: StandaloneLoopLockPrismaClient,
  owner: string,
  repo: string,
  sha: string,
  ttlMs: number = DEFAULT_LOCK_TTL_MS
): Promise<boolean> {
  try {
    await prisma.standaloneLoopLock.create({ data: { owner, repo, sha } });
    return true;
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;
  }

  const staleCutoff = new Date(Date.now() - ttlMs);
  const reclaimed = await prisma.standaloneLoopLock.deleteMany({
    where: { owner, repo, sha, heartbeatAt: { lt: staleCutoff } },
  });
  if (reclaimed.count === 0) {
    return false; // still actively held by someone else
  }

  try {
    await prisma.standaloneLoopLock.create({ data: { owner, repo, sha } });
    return true;
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;
    return false; // another instance reclaimed it first
  }
}

/** Renews the lock's heartbeat. A no-op (0 rows affected) if the lock was already released/lost. */
export async function renewLock(
  prisma: StandaloneLoopLockPrismaClient,
  owner: string,
  repo: string,
  sha: string
): Promise<void> {
  await prisma.standaloneLoopLock.updateMany({ where: { owner, repo, sha }, data: { heartbeatAt: new Date() } });
}

/** Releases the lock unconditionally. A no-op if it's already gone. */
export async function releaseLock(
  prisma: StandaloneLoopLockPrismaClient,
  owner: string,
  repo: string,
  sha: string
): Promise<void> {
  await prisma.standaloneLoopLock.deleteMany({ where: { owner, repo, sha } });
}
