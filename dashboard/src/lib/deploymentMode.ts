/**
 * Centralized Deployment Mode Resolution for CARF repositories.
 *
 * CARF supports two distinct operating architectures:
 *
 * 1. STANDALONE:
 *    - CARF actively monitors the deployment via PM2 on the host.
 *    - A CARF Host Agent runs on the deployment server.
 *    - CARF owns live soak health monitoring and automated rollback execution.
 *
 * 2. AUGMENT:
 *    - An external deployment / CD system (GitHub Actions, Argo Rollouts, Flagger)
 *      owns deployment, health monitoring, and rollback.
 *    - CARF provides change-aware threshold/window policies via the /v1/threshold API.
 *    - No PM2 target, no Host Agent, and no PM2 verification is required.
 */

export type DeploymentMode = "standalone" | "augment";

export type AugmentIntegration = "github-actions" | "argo-rollouts" | "flagger" | "generic";

export interface RepoConfigLookupInput {
  storedConfig?: unknown;
  installTokenHash?: string | null;
  mode?: string | null;
}

/**
 * Resolves repository deployment mode from storedConfig or explicit mode field.
 *
 * Safe fallback rules:
 * - If explicit mode is "augment" -> "augment"
 * - If explicit mode is "standalone" -> "standalone"
 * - If storedConfig has an integration field (e.g. github-actions) -> "augment"
 * - If storedConfig has PM2 adapter keys (target, layout, cwd) -> "standalone" (preserves Sahaay)
 * - If installTokenHash is present -> "standalone"
 * - Default -> "standalone"
 */
export function resolveRepoMode(input?: RepoConfigLookupInput | null): DeploymentMode {
  if (!input) return "standalone";

  // Check explicit mode string
  if (input.mode === "augment") return "augment";
  if (input.mode === "standalone") return "standalone";

  // Inspect storedConfig json blob
  if (input.storedConfig && typeof input.storedConfig === "object" && !Array.isArray(input.storedConfig)) {
    const cfg = input.storedConfig as Record<string, unknown>;

    if (cfg.mode === "augment") return "augment";
    if (cfg.mode === "standalone") return "standalone";

    if (typeof cfg.integration === "string") return "augment";

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

  // If an installTokenHash exists and no augment cues exist, it was registered as standalone
  if (input.installTokenHash) {
    return "standalone";
  }

  return "standalone";
}

/**
 * Resolves the chosen Augment integration (e.g. GitHub Actions, Argo Rollouts, Flagger, Generic HTTP).
 */
export function resolveAugmentIntegration(input?: RepoConfigLookupInput | null): AugmentIntegration {
  if (input?.storedConfig && typeof input.storedConfig === "object" && !Array.isArray(input.storedConfig)) {
    const cfg = input.storedConfig as Record<string, unknown>;
    const integration = typeof cfg.integration === "string" ? cfg.integration.toLowerCase() : "";
    if (integration === "argo-rollouts" || integration === "argo") return "argo-rollouts";
    if (integration === "flagger") return "flagger";
    if (integration === "generic" || integration === "api") return "generic";
  }
  return "github-actions";
}

export function isStandaloneRepo(input?: RepoConfigLookupInput | null): boolean {
  return resolveRepoMode(input) === "standalone";
}

export function isAugmentRepo(input?: RepoConfigLookupInput | null): boolean {
  return resolveRepoMode(input) === "augment";
}
