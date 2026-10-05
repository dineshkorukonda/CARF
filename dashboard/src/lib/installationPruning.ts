import { signGithubAppJwt } from "../adapters/github/appInstallClient";
import { env } from "../config/env";
import type { InstallationRow } from "./accountService";

/** Narrow Prisma surface so the logic is unit-testable without a DB. */
export interface PrunePrismaClient {
  installation: {
    delete(args: { where: { installationId: string } }): Promise<unknown>;
  };
  repoConnection?: {
    deleteMany(args: { where: { installationId: string } }): Promise<unknown>;
  };
}

export type InstallationExistsFn = (installationId: string) => Promise<boolean | "unknown">;

/** GitHub answers 404 for an installation that was uninstalled; anything else is "unknown" (never delete on doubt). */
export function createGithubInstallationExists(fetchFn: typeof fetch = fetch): InstallationExistsFn {
  return async (installationId) => {
    try {
      const jwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
      const res = await fetchFn(`https://api.github.com/app/installations/${installationId}`, {
        signal: AbortSignal.timeout(4000),
        headers: { Authorization: `Bearer ${jwt}`, Accept: "application/vnd.github+json" },
      });
      if (res.status === 404) return false;
      if (res.ok) return true;
      return "unknown";
    } catch {
      return "unknown";
    }
  };
}

const lastRun = new Map<string, number>();
const THROTTLE_MS = 60_000;

/**
 * Drops installations GitHub reports as gone (plus their repo connections) and returns the
 * survivors. Throttled per user so it costs at most one GitHub call per installation a minute.
 */
export async function pruneStaleInstallations(
  prisma: PrunePrismaClient,
  userId: string,
  installations: InstallationRow[],
  exists: InstallationExistsFn = createGithubInstallationExists(),
  now: () => number = Date.now
): Promise<InstallationRow[]> {
  const last = lastRun.get(userId);
  if (last !== undefined && now() - last < THROTTLE_MS) return installations;
  lastRun.set(userId, now());

  const keep: InstallationRow[] = [];
  for (const inst of installations) {
    if ((await exists(inst.installationId)) === false) {
      try {
        await prisma.repoConnection?.deleteMany({ where: { installationId: inst.installationId } });
        await prisma.installation.delete({ where: { installationId: inst.installationId } });
        continue;
      } catch (error) {
        console.error("[installation-prune] failed to delete stale installation", inst.installationId, error);
      }
    }
    keep.push(inst);
  }
  return keep;
}

/** Test hook. */
export function resetPruneThrottle(): void {
  lastRun.clear();
}
