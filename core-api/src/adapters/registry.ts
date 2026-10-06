import type { DeploymentIntegration, RuntimeAdapter } from "./contracts.js";
import { PM2Adapter, type PM2AdapterOptions } from "./pm2.js";
import { DockerAdapter, type DockerAdapterOptions } from "./docker.js";
import { KubernetesAdapter, type KubernetesAdapterOptions } from "./kubernetes.js";
import { NoneRuntimeAdapter } from "./none.js";
import { GitHubActionsIntegration, type GitHubActionsIntegrationOptions } from "./githubActions.js";
import { GenericHttpIntegration, type GenericHttpIntegrationOptions } from "./genericHttp.js";
import { ArgoRolloutsIntegration, type ArgoRolloutsIntegrationOptions } from "./argoRollouts.js";
import { FlaggerIntegration, type FlaggerIntegrationOptions } from "./flagger.js";

export interface DetectionResult {
  recommendedIntegration: "github_actions" | "argo_rollouts" | "flagger" | "generic_http";
  recommendedRuntime: "pm2" | "docker" | "kubernetes" | "none";
  reasons: string[];
}

/**
 * Creates a RuntimeAdapter instance based on the adapter kind.
 */
export function createRuntimeAdapter(
  kind: string,
  baseSha: string = "",
  options: Record<string, unknown> = {}
): RuntimeAdapter {
  const normalized = kind.toLowerCase().trim();

  switch (normalized) {
    case "pm2": {
      const adapter = new PM2Adapter(baseSha, options as PM2AdapterOptions);
      (adapter as { kind?: string }).kind = "pm2";
      return adapter;
    }

    case "docker":
      return new DockerAdapter(baseSha, options as DockerAdapterOptions);

    case "kubernetes":
    case "k8s":
      return new KubernetesAdapter(baseSha, options as KubernetesAdapterOptions);

    case "none":
    default:
      return new NoneRuntimeAdapter();
  }
}

/**
 * Creates a DeploymentIntegration instance based on the integration kind.
 */
export function createDeploymentIntegration(
  kind: string,
  options: Record<string, unknown> = {}
): DeploymentIntegration {
  const normalized = kind.toLowerCase().trim();

  switch (normalized) {
    case "argo_rollouts":
    case "argorollouts":
      return new ArgoRolloutsIntegration(options as ArgoRolloutsIntegrationOptions);

    case "flagger":
      return new FlaggerIntegration(options as FlaggerIntegrationOptions);

    case "generic_http":
    case "generic":
      return new GenericHttpIntegration(options as GenericHttpIntegrationOptions);

    case "github_actions":
    default:
      return new GitHubActionsIntegration(options as GitHubActionsIntegrationOptions);
  }
}

/**
 * Automatically inspects repository file paths to recommend deployment integrations and runtime adapters.
 */
export function detectRepositoryAdapters(files: string[]): DetectionResult {
  const reasons: string[] = [];
  let recommendedIntegration: DetectionResult["recommendedIntegration"] = "github_actions";
  let recommendedRuntime: DetectionResult["recommendedRuntime"] = "none";

  const lowerFiles = files.map((f) => f.toLowerCase());

  // 1. Check for Deployment Integrations
  const hasArgo = lowerFiles.some((f) => f.includes("argo") || f.includes("rollout"));
  const hasFlagger = lowerFiles.some((f) => f.includes("flagger") || f.includes("canary.yaml"));
  const hasGithub = lowerFiles.some((f) => f.startsWith(".github/workflows/"));

  if (hasFlagger) {
    recommendedIntegration = "flagger";
    reasons.push("Detected Flagger canary definitions in repository");
  } else if (hasArgo) {
    recommendedIntegration = "argo_rollouts";
    reasons.push("Detected Argo Rollouts specifications in repository");
  } else if (hasGithub) {
    recommendedIntegration = "github_actions";
    reasons.push("Detected GitHub Actions CI/CD workflows (.github/workflows/)");
  } else {
    recommendedIntegration = "generic_http";
    reasons.push("Defaulting to Generic HTTP API integration");
  }

  // 2. Check for Runtime Adapters
  const hasK8s = lowerFiles.some(
    (f) =>
      f.includes("kubernetes/") ||
      f.includes("k8s/") ||
      f.endsWith("deployment.yaml") ||
      f.endsWith("deployment.yml")
  );
  const hasDocker = lowerFiles.some(
    (f) =>
      f.endsWith("dockerfile") ||
      f.includes("docker-compose") ||
      f.endsWith("compose.yml") ||
      f.endsWith("compose.yaml")
  );
  const hasPm2 = lowerFiles.some(
    (f) => f.includes("ecosystem.config") || f.includes("pm2.config")
  );

  if (hasK8s || recommendedIntegration === "argo_rollouts" || recommendedIntegration === "flagger") {
    recommendedRuntime = "kubernetes";
    reasons.push("Detected Kubernetes manifests / cloud-native progressive delivery controllers");
  } else if (hasDocker) {
    recommendedRuntime = "docker";
    reasons.push("Detected Dockerfile or Docker Compose configuration");
  } else if (hasPm2) {
    recommendedRuntime = "pm2";
    reasons.push("Detected PM2 ecosystem configuration");
  } else {
    recommendedRuntime = "none";
    reasons.push("No explicit host runtime configuration detected; policy-only gating selected");
  }

  return {
    recommendedIntegration,
    recommendedRuntime,
    reasons,
  };
}
