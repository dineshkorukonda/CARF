/**
 * Mirrors dashboard/src/lib/deploymentMode.ts — duplicated, not imported,
 * because core-api and dashboard are separate packages.
 */

export type DeploymentMode = "standalone" | "augment";

export interface RepoModeLookupInput {
  mode?: string | null;
  storedConfig?: unknown;
  installTokenHash?: string | null;
}

function parseMode(value: unknown): DeploymentMode | null {
  if (value === "augment" || value === "standalone") return value;
  return null;
}

export function resolveRepoMode(input?: RepoModeLookupInput | null): DeploymentMode {
  if (!input) return "standalone";

  const fromColumn = parseMode(input.mode);
  if (fromColumn) return fromColumn;

  if (input.storedConfig && typeof input.storedConfig === "object" && !Array.isArray(input.storedConfig)) {
    const cfg = input.storedConfig as Record<string, unknown>;
    const fromStored = parseMode(cfg.mode);
    if (fromStored) return fromStored;
    if (typeof cfg.integration === "string" && cfg.integration.trim()) return "augment";
    if (
      typeof cfg.target === "string" ||
      typeof cfg.name === "string" ||
      typeof cfg.layout === "string" ||
      typeof cfg.cwd === "string" ||
      (cfg.adapter && typeof cfg.adapter === "object")
    ) {
      return "standalone";
    }
  }

  if (input.installTokenHash) return "standalone";
  return "standalone";
}
