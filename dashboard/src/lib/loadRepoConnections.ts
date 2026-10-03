import { activityErrorMessage } from "./repoActivity";

export interface LoadedRepoConnection {
  id: string;
  installationId: string;
  owner: string;
  repo: string;
  mode?: string | null;
  verifiedAt: string | null;
  monitoringPaused: boolean;
  storedConfig?: unknown;
  installTokenHash?: string | null;
  agentLastHeartbeat?: string | null;
  agentRevoked?: boolean | null;
}

interface RepoConnectionReader {
  repoConnection: {
    findMany: (args: { where: { installationId: { in: string[] } } }) => Promise<unknown[]>;
  };
  $queryRawUnsafe?: (query: string, ...values: unknown[]) => Promise<unknown[]>;
}

function serializeDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

export function serializeRepoConnection(row: unknown): LoadedRepoConnection {
  const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  return {
    id: String(record.id ?? ""),
    installationId: String(record.installationId ?? ""),
    owner: String(record.owner ?? ""),
    repo: String(record.repo ?? ""),
    mode: typeof record.mode === "string" ? record.mode : null,
    verifiedAt: serializeDate(record.verifiedAt),
    monitoringPaused: Boolean(record.monitoringPaused),
    storedConfig: record.storedConfig ?? null,
    installTokenHash: typeof record.installTokenHash === "string" ? record.installTokenHash : null,
    agentLastHeartbeat: serializeDate(record.agentLastHeartbeat),
    agentRevoked: record.agentRevoked == null ? null : Boolean(record.agentRevoked),
  };
}

function isMissingModeColumn(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String(err.code) : "";
  const message = "message" in err ? String(err.message) : "";
  const meta =
    "meta" in err && err.meta && typeof err.meta === "object"
      ? (err.meta as Record<string, unknown>)
      : {};
  const column = typeof meta.column === "string" ? meta.column : "";
  return (
    code === "P2022" &&
    (/mode/i.test(column) || /DeploymentMode|\.mode\b|column [`\"]?mode[`\"]?/i.test(message))
  );
}

/**
 * Loads RepoConnection rows without taking down a dashboard page.
 *
 * If the additive `mode` column has not been migrated yet, falls back to a
 * raw SELECT that omits it so Add Repository still works.
 */
export async function loadRepoConnections(
  prisma: RepoConnectionReader,
  installationIds: string[]
): Promise<{ value: LoadedRepoConnection[]; error: string | null }> {
  if (installationIds.length === 0) {
    return { value: [], error: null };
  }

  try {
    const rows = await prisma.repoConnection.findMany({
      where: { installationId: { in: installationIds } },
    });
    return { value: rows.map(serializeRepoConnection), error: null };
  } catch (err) {
    console.error("[loadRepoConnections] findMany failed:", err);

    if (isMissingModeColumn(err) && typeof prisma.$queryRawUnsafe === "function") {
      try {
        const placeholders = installationIds.map((_, index) => `$${index + 1}`).join(", ");
        const rows = await prisma.$queryRawUnsafe(
          `SELECT id, "installationId", owner, repo, "verifiedAt", "monitoringPaused", "storedConfig", "installTokenHash", "agentLastHeartbeat", "agentRevoked" FROM "RepoConnection" WHERE "installationId" IN (${placeholders})`,
          ...installationIds
        );
        return {
          value: rows.map((row) => serializeRepoConnection({ ...(row as object), mode: null })),
          error:
            "RepoConnection.mode is not in the database yet. From core-api run `npx prisma migrate deploy`. Existing connections are shown without the new column.",
        };
      } catch (fallbackErr) {
        console.error("[loadRepoConnections] raw fallback failed:", fallbackErr);
      }
    }

    return { value: [], error: activityErrorMessage(err) };
  }
}
