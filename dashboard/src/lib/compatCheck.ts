export interface CompatSignal {
  id: string;
  label: string;
  matched: boolean;
  detail: string;
}

export type RecommendedMode = "standalone" | "augment" | "either" | "unclear";

export interface CompatibilityReport {
  signals: CompatSignal[];
  recommendedMode: RecommendedMode;
  recommendedAdapter?: string;
  summary: string;
}

function matchesAny(paths: string[], patterns: RegExp[]): boolean {
  return paths.some((path) => patterns.some((pattern) => pattern.test(path)));
}

const STANDALONE_SIGNAL_IDS = ["pm2"];
const AUGMENT_SIGNAL_IDS = ["argoRollouts", "flagger"];

/**
 * Pure classification of a repo's file paths against the deployment targets CARF's
 * rollback adapters know how to drive (core-api/src/adapters/pm2: PM2 [active])
 * and the progressive-delivery tools Augment mode plugs into
 * (Argo Rollouts, Flagger [planned]). No I/O -- callers supply the path list (a GitHub tree fetch,
 * a local `git ls-files`, wherever), so this is unit-testable with in-memory fixtures.
 */
export function evaluateCompatibility(paths: string[]): CompatibilityReport {
  const kubernetes = matchesAny(paths, [
    /(^|\/)k8s\/.*\.ya?ml$/i,
    /(^|\/)kubernetes\/.*\.ya?ml$/i,
    /(^|\/)manifests\/.*\.ya?ml$/i,
    /(^|\/)helm\/.*Chart\.ya?ml$/i,
    /^Chart\.ya?ml$/i,
  ]);
  const dockerCompose = matchesAny(paths, [/(^|\/)(docker-)?compose\.ya?ml$/i]);
  const dockerfile = matchesAny(paths, [/(^|\/)Dockerfile(\.[\w-]+)?$/i]);
  const pm2 = matchesAny(paths, [/(^|\/)ecosystem\.config\.(js|cjs|json)$/i]);
  const gitops = matchesAny(paths, [/(^|\/)(argocd|flux)\//i, /(^|\/)kustomization\.ya?ml$/i]);
  const argoRollouts = matchesAny(paths, [/(^|\/)rollouts?\/.*\.ya?ml$/i, /rollout[^/]*\.ya?ml$/i]);
  const flagger = matchesAny(paths, [/(^|\/)canary[^/]*\.ya?ml$/i, /flagger/i]);
  const githubActions = matchesAny(paths, [/^\.github\/workflows\/.*\.ya?ml$/i]);

  const signals: CompatSignal[] = [
    {
      id: "kubernetes",
      label: "Kubernetes manifests / Helm chart",
      matched: kubernetes,
      detail: kubernetes
        ? "Found k8s/Helm manifests — Kubernetes standalone adapter is planned / not yet built (Augment mode planned for external canary gating)."
        : "No k8s/, kubernetes/, manifests/, or Chart.yaml found.",
    },
    {
      id: "dockerCompose",
      label: "Docker Compose file",
      matched: dockerCompose,
      detail: dockerCompose
        ? "Found a compose file — note: Docker Compose standalone adapter is not yet built (Augment mode planned for external pipelines)."
        : "No docker-compose.yml/compose.yaml found.",
    },
    {
      id: "dockerfile",
      label: "Dockerfile",
      matched: dockerfile,
      detail: dockerfile
        ? "Containerized application layout."
        : "No Dockerfile found.",
    },
    {
      id: "pm2",
      label: "PM2 ecosystem file",
      matched: pm2,
      detail: pm2
        ? "Found an ecosystem.config file — the PM2 Standalone adapter will work out of the box (actively verified)."
        : "No ecosystem.config.js/cjs/json found.",
    },
    {
      id: "gitops",
      label: "GitOps (Argo CD / Flux) manifests",
      matched: gitops,
      detail: gitops
        ? "Found GitOps-style manifests — GitOps/Argo is an external augment consumer (planned), not a standalone rollback adapter."
        : "No argocd/, flux/, or kustomization.yaml found.",
    },
    {
      id: "argoRollouts",
      label: "Argo Rollouts",
      matched: argoRollouts,
      detail: argoRollouts
        ? "Looks like Argo Rollouts is already in use — Augment mode (planned: GET /v1/augment/threshold feeding an AnalysisTemplate) will be the natural fit."
        : "No Rollout-style manifests found.",
    },
    {
      id: "flagger",
      label: "Flagger",
      matched: flagger,
      detail: flagger
        ? "Looks like Flagger is already in use — Augment mode (planned: webhook calling GET /v1/augment/threshold) will be the natural fit."
        : "No Canary/Flagger manifests found.",
    },
    {
      id: "githubActions",
      label: "GitHub Actions CI",
      matched: githubActions,
      detail: githubActions
        ? "GitHub Actions is already set up — augment-mode integration planned via GET /v1/augment/threshold."
        : "No .github/workflows found.",
    },
  ];

  const standaloneMatches = signals.filter((s) => STANDALONE_SIGNAL_IDS.includes(s.id) && s.matched);
  const augmentMatches = signals.filter((s) => AUGMENT_SIGNAL_IDS.includes(s.id) && s.matched);

  if (augmentMatches.length > 0) {
    return {
      signals,
      recommendedMode: standaloneMatches.length > 0 ? "either" : "augment",
      summary: `${augmentMatches.map((s) => s.label).join(" and ")} already ${
        augmentMatches.length === 1 ? "runs" : "run"
      } here — Augment mode (planned: GET /v1/augment/threshold) will let external controllers use CARF thresholds while keeping your existing rollout mechanics.`,
    };
  }

  if (standaloneMatches.length > 0) {
    return {
      signals,
      recommendedMode: "standalone",
      recommendedAdapter: standaloneMatches[0].id,
      summary: `${standaloneMatches
        .map((s) => s.label)
        .join(", ")} detected — Standalone mode can drive rollback here directly, no other pipeline required.`,
    };
  }

  return {
    signals,
    recommendedMode: "unclear",
    summary:
      "No supported deployment target detected yet. CARF's classifier works on any repo, but live Standalone rollback requires a PM2 ecosystem file. Other standalone adapters (Kubernetes, Compose) and Augment mode (GET /v1/augment/threshold) are planned.",
  };
}
