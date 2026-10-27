import { randomUUID } from "node:crypto";
import { DEFAULT_LOCK_TTL_MS, type StandaloneLoopLockPrismaClient } from "./standaloneLoopLock.js";
import type { RollbackAdapter } from "./rollbackAdapter.js";

// A fixed key serializes different commits of the same repository. The row ID
// identifies the holder, so an expired worker cannot renew/delete its successor.
const DEPLOYMENT_KEY = "__deployment__";
export class DeploymentLeaseLostError extends Error {}
export interface DeploymentLease {
  assertHeld(): Promise<void>;
  release(): Promise<void>;
}

export function guardAdapter(adapter: RollbackAdapter, lease: DeploymentLease): RollbackAdapter {
  return new Proxy(adapter, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        await lease.assertHeld();
        const result: unknown = await Reflect.apply(value, target, args);
        await lease.assertHeld();
        return result;
      };
    },
  });
}

export async function acquireDeploymentLease(
  prisma: StandaloneLoopLockPrismaClient, owner: string, repo: string,
  ttlMs = DEFAULT_LOCK_TTL_MS,
): Promise<DeploymentLease | null> {
  const scope = { owner: owner.toLowerCase(), repo: repo.toLowerCase(), sha: DEPLOYMENT_KEY };
  const id = randomUUID();
  const create = () => prisma.standaloneLoopLock.create({ data: { ...scope, id } });
  const isConflict = (error: unknown) => typeof error === "object" && error !== null &&
    "code" in error && error.code === "P2002";
  try { await create(); } catch (error) {
    if (!isConflict(error)) throw error;
    const removed = await prisma.standaloneLoopLock.deleteMany({
      where: { ...scope, heartbeatAt: { lt: new Date(Date.now() - ttlMs) } },
    });
    if (removed.count !== 1) return null;
    try { await create(); } catch (retryError) {
      if (!isConflict(retryError)) throw retryError;
      return null;
    }
  }
  return {
    async assertHeld() {
      const result = await prisma.standaloneLoopLock.updateMany({
        where: { ...scope, id }, data: { heartbeatAt: new Date() },
      });
      if (result.count !== 1) throw new DeploymentLeaseLostError("Deployment ownership was lost");
    },
    async release() { await prisma.standaloneLoopLock.deleteMany({ where: { ...scope, id } }); },
  };
}
