/**
 * CARF Terminology and Nomenclature Standardization
 *
 * Single source of truth for UI terminology, labels, descriptions, and capability names
 * across the CARF Dashboard.
 *
 * Core Terminology Distinctions:
 * - CARF Core: Central change analysis, risk scoring, threshold calculation, and policy engine.
 * - Deployment Integration: The CI/CD pipeline or rollout controller (GitHub Actions, Generic HTTP, Argo Rollouts).
 * - Runtime Integration: Application execution platform (PM2, Docker / Docker Compose, Kubernetes, systemd, or Policy Only).
 * - Deployment Environment: Logical environment classification (Development, Staging, Production).
 * - Deployment Target: The specific application, process, service, or workload managed by a runtime integration.
 * - Health Provider: Source of application health and telemetry measurements (e.g. Prometheus / PromQL).
 * - Runtime Adapter: Internal implementation driver communicating with a runtime platform.
 * - Execution Mode: Legacy Augment / Standalone architecture behavior where mode distinctions are relevant.
 * - Integration Maturity: Active, Preview, or Roadmap status (separate from operational readiness).
 */

export const CARF_TERMS = {
  core: {
    term: "CARF Core",
    label: "CARF Core",
    description: "Central change analysis, risk scoring, threshold calculation, and policy engine.",
  },
  deploymentIntegration: {
    term: "Deployment Integration",
    label: "Deployment Integration",
    description: "The CI/CD pipeline or rollout controller that initiates, orchestrates, or gates deployment.",
    helpText: "Choose how your application is deployed or how CARF connects to your existing deployment workflow.",
  },
  runtimeIntegration: {
    term: "Runtime Integration",
    label: "Runtime Integration",
    description: "The platform or environment where the application actually executes and is managed.",
    helpText: "Choose the platform running your application so CARF can determine available monitoring and rollback capabilities.",
  },
  deploymentEnvironment: {
    term: "Deployment Environment",
    label: "Deployment Environment",
    description: "Logical deployment classification (e.g., Development, Staging, Production). Distinct from runtime platforms or hosts.",
  },
  deploymentTarget: {
    term: "Deployment Target",
    label: "Deployment Target",
    description: "The specific application, process, service, container, or workload managed by a runtime integration.",
    helpText: "Specify the application, process, service, or workload CARF should manage.",
  },
  healthProvider: {
    term: "Health Provider",
    label: "Health Provider",
    description: "Source of application health and telemetry measurements (e.g., Prometheus / PromQL). Distinct from deployment or runtime integrations.",
    helpText: "Choose the source of health metrics used to evaluate deployments.",
  },
  runtimeAdapter: {
    term: "Runtime Adapter",
    label: "Runtime Adapter",
    description: "Internal implementation mechanism/driver communicating with a specific runtime platform.",
  },
  executionMode: {
    term: "Execution Mode",
    label: "Execution Mode",
    description: "Execution architecture mode (Standalone or Augment) when mode distinctions are relevant.",
  },
  integrationMaturity: {
    term: "Integration Maturity",
    label: "Integration Maturity",
    description: "Maturity status of an integration (Active, Preview, or Roadmap), distinct from operational readiness.",
  },
} as const;

/**
 * Official CARF Capabilities names.
 */
export const CAPABILITY_LABELS = {
  policy: "Risk Policy",
  monitoring: "Runtime Monitoring",
  rollback: "Automated Rollback",
} as const;

export type CapabilityKey = keyof typeof CAPABILITY_LABELS;

export const CAPABILITY_DESCRIPTIONS: Record<CapabilityKey, string> = {
  policy: "Change analysis, commit risk scoring, and dynamic error-rate thresholding.",
  monitoring: "Active runtime telemetry observation and health verification during soak window.",
  rollback: "Automated deployment recovery restoring the previous healthy revision upon threshold breach.",
};

/**
 * Setup wizard step explanations and help text.
 */
export const SETUP_EXPLANATIONS = {
  deploymentIntegration: "Choose how your application is deployed or how CARF connects to your existing deployment workflow.",
  runtimeIntegration: "Choose the platform running your application so CARF can determine available monitoring and rollback capabilities.",
  deploymentTarget: "Specify the application, process, service, or workload CARF should manage.",
  healthProvider: "Choose the source of health metrics used to evaluate deployments.",
  policyOnly: "Policy-only integrations evaluate risk and serve thresholds without requiring a runtime target.",
} as const;

/**
 * Integration Maturity Levels.
 */
export type IntegrationMaturity = "active" | "preview" | "roadmap";

export interface MaturityBadgeConfig {
  label: string;
  className: string;
  tagColor: string;
}

export const MATURITY_BADGES: Record<IntegrationMaturity, MaturityBadgeConfig> = {
  active: {
    label: "Active",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    tagColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  preview: {
    label: "Preview",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    tagColor: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  roadmap: {
    label: "Roadmap",
    className: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    tagColor: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  },
};

/**
 * Integration categories for documentation and directory views.
 */
export const INTEGRATION_CATEGORIES = {
  deployment: "Deployment Integrations",
  runtime: "Runtime Integrations",
  health: "Health Providers",
} as const;

/**
 * Helper to get capability display label.
 */
export function getCapabilityLabel(key: CapabilityKey): string {
  return CAPABILITY_LABELS[key];
}

/**
 * Helper to format execution mode display.
 */
export function getExecutionModeLabel(mode?: string | null): string {
  if (mode === "augment") return "Augment (External CD)";
  if (mode === "standalone") return "Standalone (Direct Rollback)";
  return "Standard";
}
