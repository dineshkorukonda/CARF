/**
 * Centralized capability resolver for CARF 3-layer architecture.
 *
 * Defines the capability matrix across:
 * - Deployment Integration (delivery pipeline / orchestrator)
 * - Runtime Adapter (process execution & health feedback)
 *
 * Enforces:
 * 1. Only live adapters (PM2) provide active monitoring and automated rollback.
 * 2. Roadmap/preview adapters (Kubernetes, Docker, systemd) do not claim live rollback capabilities.
 * 3. Backward compatibility mapping from legacy `mode` (standalone/augment).
 * 4. Local PM2 runtime connects directly without requiring a CARF host agent.
 */

export const DEPLOYMENT_INTEGRATIONS = [
  "github_actions",
  "argo_rollouts",
  "flagger",
  "generic_http",
] as const;

export type DeploymentIntegration = (typeof DEPLOYMENT_INTEGRATIONS)[number];

export const RUNTIME_ADAPTERS = [
  "none",
  "pm2",
  "kubernetes",
  "docker",
  "systemd",
] as const;

export type RuntimeAdapter = (typeof RUNTIME_ADAPTERS)[number];

export interface CarfCapabilities {
  /** Dynamic threshold calculation, commit classification & risk gating */
  policy: boolean;
  /** Active process/endpoint telemetry monitoring */
  monitoring: boolean;
  /** Automated runtime rollback control */
  rollback: boolean;
}

export type IntegrationStatus = "active" | "preview" | "roadmap";

export interface ResolvedCapabilities {
  deploymentIntegration: DeploymentIntegration;
  runtimeAdapter: RuntimeAdapter;
  capabilities: CarfCapabilities;
  integrationLabel: string;
  runtimeLabel: string;
  runtimeStatus: IntegrationStatus;
  deploymentStatus: IntegrationStatus;
  requiresAgent: boolean;
  description: string;
}

export interface LegacyConfigInput {
  repo?: string | null | undefined;
  mode?: string | null | undefined;
  deploymentIntegration?: string | null | undefined;
  runtimeAdapter?: string | null | undefined;
  storedConfig?: unknown | undefined;
  adapter?: { kind?: string | null | undefined; target?: string | null | undefined } | null | undefined;
}

/**
 * Normalizes string inputs to known DeploymentIntegration enum.
 */
export function normalizeDeploymentIntegration(value?: string | null | undefined): DeploymentIntegration {
  if (!value) return "github_actions";
  const normalized = value.toLowerCase().replace(/[- ]/g, "_");
  if (normalized === "github_actions" || normalized === "github") return "github_actions";
  if (normalized === "argo_rollouts" || normalized === "argo") return "argo_rollouts";
  if (normalized === "flagger") return "flagger";
  if (normalized === "generic_http" || normalized === "generic" || normalized === "http" || normalized === "api") {
    return "generic_http";
  }
  return "github_actions";
}

/**
 * Normalizes string inputs to known RuntimeAdapter enum.
 */
export function normalizeRuntimeAdapter(value?: string | null | undefined): RuntimeAdapter {
  if (!value) return "none";
  const normalized = value.toLowerCase().replace(/[- ]/g, "_");
  if (normalized === "pm2") return "pm2";
  if (normalized === "kubernetes" || normalized === "k8s") return "kubernetes";
  if (normalized === "docker" || normalized.startsWith("docker_") || normalized === "container") return "docker";
  if (normalized === "systemd" || normalized === "systemctl") return "systemd";
  if (normalized === "none" || normalized === "augment" || normalized === "null" || normalized.startsWith("no_direct")) return "none";
  return "none";
}

export const INTEGRATION_METADATA: Record<
  DeploymentIntegration,
  { label: string; status: IntegrationStatus; description: string }
> = {
  github_actions: {
    label: "GitHub Actions",
    status: "active",
    description: "Evaluates commit risk in CI workflow and applies dynamic thresholds before deploy.",
  },
  argo_rollouts: {
    label: "Argo Rollouts",
    status: "preview",
    description: "Step-by-step progressive delivery analysis for Kubernetes rollouts.",
  },
  flagger: {
    label: "Flagger",
    status: "preview",
    description: "Automated canary promotion and rollback using Istio/Linkerd metrics.",
  },
  generic_http: {
    label: "Generic HTTP / CI",
    status: "active",
    description: "REST API integration for any CI/CD pipeline (GitLab, Jenkins, CircleCI).",
  },
};

export const RUNTIME_METADATA: Record<
  RuntimeAdapter,
  { label: string; status: IntegrationStatus; requiresAgent: boolean; description: string }
> = {
  none: {
    label: "No direct runtime integration (Policy only)",
    status: "active",
    requiresAgent: false,
    description: "CARF acts as an advisory/gating policy authority. Deployments are controlled by your CI/CD pipeline without host agents.",
  },
  pm2: {
    label: "PM2 Process Manager",
    status: "active",
    requiresAgent: false,
    description: "CARF interacts directly with local PM2 to track process metrics and trigger automated rollbacks when thresholds breach.",
  },
  kubernetes: {
    label: "Kubernetes Pods / ReplicaSets",
    status: "preview",
    requiresAgent: false,
    description: "Direct cluster telemetry via Kubernetes Events API and rollout undo commands (Preview / Roadmap).",
  },
  docker: {
    label: "Docker Engine / Compose",
    status: "preview",
    requiresAgent: true,
    description: "Container health monitoring via Docker daemon API and previous image re-tagging (Roadmap).",
  },
  systemd: {
    label: "systemd Service",
    status: "roadmap",
    requiresAgent: true,
    description: "Linux system service journal monitoring and unit rollbacks (Roadmap).",
  },
};

/**
 * Pure function resolving active capabilities and labels from integration and runtime selection.
 */
export function resolveCapabilities(
  integrationInput?: string | null | undefined,
  runtimeInput?: string | null | undefined
): ResolvedCapabilities {
  const deploymentIntegration = normalizeDeploymentIntegration(integrationInput);
  const runtimeAdapter = normalizeRuntimeAdapter(runtimeInput);

  const integMeta = INTEGRATION_METADATA[deploymentIntegration];
  const runtimeMeta = RUNTIME_METADATA[runtimeAdapter];

  // CARF Core always provides policy (thresholds, classification, risk scoring).
  const policy = true;

  // Active monitoring is enabled only when runtime adapter has live monitoring capability.
  // Currently, only PM2 is implemented for active live telemetry monitoring.
  const monitoring = runtimeAdapter === "pm2";

  // Automated rollback is enabled only when runtime adapter has live execution capability.
  // PM2 is currently the only active runtime rollback adapter.
  const rollback = runtimeAdapter === "pm2";

  let description = "Policy-only gating in delivery pipeline.";
  if (rollback) {
    description = "Full closed-loop automated rollback and live telemetry via PM2.";
  } else if (runtimeMeta.status !== "active") {
    description = `Policy gating active; ${runtimeMeta.label} runtime integration is currently in ${runtimeMeta.status}.`;
  }

  return {
    deploymentIntegration,
    runtimeAdapter,
    capabilities: {
      policy,
      monitoring,
      rollback,
    },
    integrationLabel: integMeta.label,
    runtimeLabel: runtimeMeta.label,
    runtimeStatus: runtimeMeta.status,
    deploymentStatus: integMeta.status,
    requiresAgent: runtimeMeta.requiresAgent,
    description,
  };
}

/**
 * Resolves 3-layer architecture from either explicit columns or legacy configs.
 * Backward compatibility:
 * - mode === "standalone" or storedConfig.mode === "standalone" or adapter.kind === "pm2" -> github_actions + pm2
 * - mode === "augment" or storedConfig.mode === "augment" -> github_actions + none
 */
export function resolveFromLegacy(input?: LegacyConfigInput | null): ResolvedCapabilities {
  if (!input) {
    return resolveCapabilities("github_actions", "none");
  }

  // If explicit 3-layer properties are defined, prefer them
  if (input.deploymentIntegration || input.runtimeAdapter) {
    return resolveCapabilities(input.deploymentIntegration, input.runtimeAdapter);
  }

  const stored = (input.storedConfig ?? {}) as Record<string, unknown>;

  // Check storedConfig explicit fields
  if (typeof stored.deploymentIntegration === "string" || typeof stored.runtimeAdapter === "string") {
    return resolveCapabilities(
      typeof stored.deploymentIntegration === "string" ? stored.deploymentIntegration : undefined,
      typeof stored.runtimeAdapter === "string" ? stored.runtimeAdapter : undefined
    );
  }

  // Check legacy mode and targets
  const mode = input.mode ?? (typeof stored.mode === "string" ? stored.mode : null);
  const adapterKind = input.adapter?.kind ?? (typeof stored.kind === "string" ? stored.kind : null);
  const hasTarget = typeof stored.target === "string" && stored.target.length > 0;

  if (mode === "standalone" || adapterKind === "pm2" || hasTarget) {
    return resolveCapabilities("github_actions", "pm2");
  }

  if (mode === "augment" || stored.integration === "github-actions") {
    return resolveCapabilities("github_actions", "none");
  }

  // Default to GitHub Actions + Policy-only (no agent requirement)
  return resolveCapabilities("github_actions", "none");
}
