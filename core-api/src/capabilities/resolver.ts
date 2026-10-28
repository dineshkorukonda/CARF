/**
 * Centralized capability resolver for CARF 3-layer architecture.
 *
 * Defines the capability matrix across:
 * - Deployment Integration (delivery pipeline / orchestrator)
 * - Runtime Adapter (process execution & health feedback)
 *
 * Enforces:
 * 1. Live adapters (PM2, Docker) provide active monitoring and automated rollback.
 * 2. Roadmap/preview adapters (Kubernetes, systemd) do not claim live rollback capabilities.
 * 3. Backward compatibility mapping from legacy `mode` (standalone/augment).
 * 4. Local PM2 and Docker runtimes connect directly without requiring a CARF host agent.
 */

export const DEPLOYMENT_INTEGRATIONS = [
  "github_actions",
  "argo_rollouts",
  "generic_http",
] as const;

export type DeploymentIntegration = (typeof DEPLOYMENT_INTEGRATIONS)[number] | "unsupported";

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

export type IntegrationStatus = "active" | "preview" | "roadmap" | "unsupported";

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
  pm2Process?: string | null | undefined;
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
  if (normalized === "generic_http" || normalized === "generic" || normalized === "http" || normalized === "api") {
    return "generic_http";
  }
  return "unsupported";
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
  unsupported: { label: "Unsupported integration", status: "unsupported", description: "Select a supported deployment integration; saved configuration is retained." },
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
    status: "active",
    requiresAgent: false,
    description: "Active container health monitoring via Docker daemon and automated rollback to previous image tag or compose state.",
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
  runtimeInput?: string | null | undefined,
  infrastructure?: { localRuntimeAuthorized: boolean; adapterConfigured: boolean }
): ResolvedCapabilities {
  const deploymentIntegration = normalizeDeploymentIntegration(integrationInput);
  const runtimeAdapter = normalizeRuntimeAdapter(runtimeInput);

  const integMeta = INTEGRATION_METADATA[deploymentIntegration];
  const runtimeMeta = RUNTIME_METADATA[runtimeAdapter];

  // CARF Core always provides policy (thresholds, classification, risk scoring).
  const policy = deploymentIntegration !== "unsupported";

  // Active monitoring is enabled only when runtime adapter has live monitoring capability.
  // PM2 and Docker are actively implemented for live telemetry monitoring.
  const monitoring = policy && (deploymentIntegration === "github_actions" || deploymentIntegration === "generic_http")
    && (runtimeAdapter === "pm2" || runtimeAdapter === "docker")
    && infrastructure?.localRuntimeAuthorized === true && infrastructure.adapterConfigured;

  // Automated rollback is enabled only when runtime adapter has live execution capability.
  // PM2 and Docker are active runtime rollback adapters.
  const rollback = monitoring;

  let description = policy ? "Policy available. Monitoring and rollback require backend validation of the configured runtime and host authorization." : "Unsupported deployment integration. Saved configuration has not been changed.";
  if (rollback) {
    description =
      runtimeAdapter === "docker"
        ? "Full closed-loop automated rollback and container health monitoring via Docker."
        : "Full closed-loop automated rollback and live telemetry via PM2.";
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
 * - Explicit adapter kinds or PM2-specific evidence preserve runtime selection.
 * - Mode and a generic target alone never select PM2.
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

  // A mode or generic target alone cannot identify a runtime. Preserve explicit
  // adapter kinds and the historical PM2 process/layout fields without granting execution.
  const nested = stored.adapter && typeof stored.adapter === "object" ? stored.adapter as Record<string, unknown> : {};
  const adapterKind = input.adapter?.kind ?? stored.kind ?? nested.kind;
  const pm2Evidence = Boolean(input.pm2Process) ||
    ((stored.layout === "git" || stored.layout === "releases") && typeof stored.cwd === "string");
  const runtime = typeof adapterKind === "string" ? adapterKind : pm2Evidence ? "pm2" : "none";
  const integration = typeof stored.integration === "string" ? stored.integration : "github_actions";
  return resolveCapabilities(integration, runtime);

}
