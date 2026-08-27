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

const STANDALONE_SIGNAL_IDS = ["kubernetes", "dockerCompose", "pm2", "gitops"];
const AUGMENT_SIGNAL_IDS = ["argoRollouts", "flagger"];

/**
 * Pure classification of a repo's file paths against the deployment targets CARF's
 * rollback adapters know how to drive (core-api/src/adapters/*: kubectl, docker compose,
 * docker swarm, pm2, gitops) and the progressive-delivery tools Augment mode plugs into
 * (Argo Rollouts, Flagger). No I/O -- callers supply the path list (a GitHub tree fetch,
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
        ? "Found k8s/Helm manifests — the Kubernetes Standalone adapter (kubectl rollout undo) will work out of the box."
        : "No k8s/, kubernetes/, manifests/, or Chart.yaml found.",
    },
    {
      id: "dockerCompose",
      label: "Docker Compose file",
      matched: dockerCompose,
      detail: dockerCompose
        ? "Found a compose file — the Docker Compose or Docker Swarm Standalone adapter will work."
        : "No docker-compose.yml/compose.yaml found.",
    },
    {
      id: "dockerfile",
      label: "Dockerfile",
      matched: dockerfile,
      detail: dockerfile
        ? "Containerized — a good sign for any of the Standalone adapters."
        : "No Dockerfile found.",
    },
    {
      id: "pm2",
      label: "PM2 ecosystem file",
      matched: pm2,
      detail: pm2
        ? "Found an ecosystem.config file — the PM2 Standalone adapter will work."
        : "No ecosystem.config.js/cjs/json found.",
    },
    {
      id: "gitops",
      label: "GitOps (Argo CD / Flux) manifests",
      matched: gitops,
      detail: gitops
        ? "Found GitOps-style manifests — the GitOps Standalone adapter can drive a Git revert."
        : "No argocd/, flux/, or kustomization.yaml found.",
    },
    {
      id: "argoRollouts",
      label: "Argo Rollouts",
      matched: argoRollouts,
      detail: argoRollouts
        ? "Looks like Argo Rollouts is already in use — Augment mode (GET /v1/threshold feeding an AnalysisTemplate) is the natural fit."
        : "No Rollout-style manifests found.",
    },
    {
      id: "flagger",
      label: "Flagger",
      matched: flagger,
      detail: flagger
        ? "Looks like Flagger is already in use — Augment mode (a MetricTemplate/webhook calling GET /v1/threshold) is the natural fit."
        : "No Canary/Flagger manifests found.",
    },
    {
      id: "githubActions",
      label: "GitHub Actions CI",
      matched: githubActions,
      detail: githubActions
        ? "GitHub Actions is already set up — the carf-threshold composite Action drops straight into an existing workflow."
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
      } here — Augment mode is the fastest path: point it at GET /v1/threshold and keep your existing rollout mechanics.`,
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
      "No supported deployment target detected yet. CARF's classifier still works on any repo, but Standalone mode needs Kubernetes manifests, a docker-compose.yml, a PM2 ecosystem file, or a GitOps target — or wire Augment mode's GET /v1/threshold into whatever already deploys this repo.",
  };
}
