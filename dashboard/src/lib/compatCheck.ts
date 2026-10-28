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
const AUGMENT_SIGNAL_IDS = ["argoRollouts"];

/**
 * Pure classification of a repo's file paths against the deployment targets CARF's
 * rollback adapters know how to drive (core-api/src/adapters/pm2: PM2 [active])
 * and the progressive-delivery tools Augment mode plugs into
 * (Argo Rollouts via GET /v1/augment/threshold). No I/O -- callers supply the path list (a GitHub tree fetch,
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
  const githubActions = matchesAny(paths, [/^\.github\/workflows\/.*\.ya?ml$/i]);

  const signals: CompatSignal[] = [
    {
      id: "kubernetes",
      label: "Kubernetes manifests / Helm chart",
      matched: kubernetes,
      detail: kubernetes
        ? "Found k8s/Helm manifests — no standalone Kubernetes adapter yet. Use Augment mode (GET /v1/augment/threshold is live) so your existing controller keeps rollback."
        : "No k8s/, kubernetes/, manifests/, or Chart.yaml found.",
    },
    {
      id: "dockerCompose",
      label: "Docker Compose file",
      matched: dockerCompose,
      detail: dockerCompose
        ? "Found a compose file — no standalone Docker Compose adapter yet. Use Augment mode (GET /v1/augment/threshold is live) for external pipelines."
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
        ? "Found GitOps-style manifests — GitOps/Argo is an external augment consumer, not a standalone rollback adapter. Query GET /v1/augment/threshold."
        : "No argocd/, flux/, or kustomization.yaml found.",
    },
    {
      id: "argoRollouts",
      label: "Argo Rollouts",
      matched: argoRollouts,
      detail: argoRollouts
        ? "Looks like Argo Rollouts is already in use — Augment mode is live: point analysis at GET /v1/augment/threshold. First-party AnalysisTemplate wiring is still an example, not a managed install."
        : "No Rollout-style manifests found.",
    },
    {
      id: "githubActions",
      label: "GitHub Actions CI",
      matched: githubActions,
      detail: githubActions
        ? "GitHub Actions is already set up — query GET /v1/augment/threshold from a workflow step."
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
      } here — Augment mode is live (GET /v1/augment/threshold) so external controllers can use CARF thresholds while keeping existing rollout mechanics.`,
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
      "No supported standalone target detected yet. CARF's classifier works on any repo, but live Standalone rollback requires a PM2 ecosystem file. Other standalone adapters (Kubernetes, Compose) are planned. Augment mode (GET /v1/augment/threshold) is live for external controllers.",
  };
}
