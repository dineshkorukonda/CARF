/**
 * Authoritative deployment-mode resolution for CARF repositories.
 *
 * STANDALONE: CARF monitors the host via PM2 + Host Agent and owns rollback.
 * AUGMENT: an external CD system owns rollout/monitor/rollback; CARF serves policy.
 *
 * Prefer RepoConnection.mode. storedConfig is only a fallback for rows that
 * predate the column or have not been regenerated yet.
 */

import { normalizeDeploymentIntegration } from "./capabilities";

export type DeploymentMode = "standalone" | "augment";

export type AugmentIntegration = "github-actions" | "argo-rollouts" | "flagger" | "generic-http";

export interface RepoConfigLookupInput {
  storedConfig?: unknown;
  installTokenHash?: string | null;
  mode?: string | null;
  deploymentIntegration?: string | null;
  runtimeAdapter?: string | null;
}

export function parseDeclaredMode(value: unknown): DeploymentMode | null {
  if (value === "augment" || value === "standalone") return value;
  return null;
}

function storedConfigObject(stored: unknown): Record<string, unknown> | null {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  return stored as Record<string, unknown>;
}

/**
 * Resolves repository deployment mode.
 *
 * Order:
 * 1. Explicit RepoConnection.mode
 * 2. storedConfig.mode
 * 3. storedConfig.integration => augment
 * 4. PM2 adapter keys / install token => standalone (preserves Sahaay)
 * 5. null input / no cues => standalone (legacy product default; new UI never
 *    writes a connection without an explicit user-chosen mode)
 */
export function resolveRepoMode(input?: RepoConfigLookupInput | null): DeploymentMode {
  if (!input) return "standalone";

  const fromColumn = parseDeclaredMode(input.mode);
  if (fromColumn) return fromColumn;

  const cfg = storedConfigObject(input.storedConfig);
  if (cfg) {
    const fromStored = parseDeclaredMode(cfg.mode);
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

export function resolveAugmentIntegration(input?: RepoConfigLookupInput | null): AugmentIntegration {
  if (input?.deploymentIntegration) {
    const norm = normalizeDeploymentIntegration(input.deploymentIntegration);
    if (norm === "argo_rollouts") return "argo-rollouts";
    if (norm === "flagger") return "flagger";
    if (norm === "generic_http") return "generic-http";
    return "github-actions";
  }
  const cfg = storedConfigObject(input?.storedConfig);
  const integration = typeof cfg?.integration === "string" ? cfg.integration.toLowerCase() : "";
  if (integration === "argo-rollouts" || integration === "argo") return "argo-rollouts";
  if (integration === "flagger") return "flagger";
  if (integration === "generic" || integration === "generic-http" || integration === "api" || integration === "http") {
    return "generic-http";
  }
  return "github-actions";
}

export function augmentIntegrationLabel(integration: AugmentIntegration): string {
  switch (integration) {
    case "github-actions":
      return "GitHub Actions";
    case "argo-rollouts":
      return "Argo Rollouts";
    case "flagger":
      return "Flagger";
    case "generic-http":
      return "Generic HTTP";
  }
}

export function isStandaloneRepo(input?: RepoConfigLookupInput | null): boolean {
  return resolveRepoMode(input) === "standalone";
}

export function isAugmentRepo(input?: RepoConfigLookupInput | null): boolean {
  return resolveRepoMode(input) === "augment";
}

export function repoIdentityKey(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

export function isAccidentalProductionRepoName(repo: string): boolean {
  return repo.trim().toLowerCase() === "production";
}
