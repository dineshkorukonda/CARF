export type GuideMode = "any" | "standalone" | "augment";

export interface GuideStep {
  title: string;
  body: string;
}

export interface PlatformGuide {
  id: string;
  name: string;
  mode: "standalone" | "augment";
  badge: string;
  summary: string;
  whenToUse: string;
  steps: GuideStep[];
  carfYml: string;
  deploySnippetTitle: string;
  deploySnippet: string;
}

export const GETTING_STARTED = {
  title: "Any GitHub project",
  mode: "any" as const,
  summary:
    "Every CARF setup starts the same way: an account, the GitHub App, and a linked repository. Adapter choice happens while linking, not as a separate installation tab.",
  steps: [
    {
      title: "Create a CARF account",
      body: "Sign up at the dashboard, then open Overview. This is your CARF identity — it is separate from which GitHub org the App is installed on.",
    },
    {
      title: "Install the GitHub App",
      body: "From GitHub Integration, install the CARF GitHub App on the organization or user that owns the repositories. Grant access to the repos you want protected.",
    },
    {
      title: "Link a project",
      body: "On Live Status, choose Link Project. Pick the repository, then choose your operational mode. Standalone mode drives health checks and rollback execution directly. Augment mode (planned: advisory threshold endpoint for external CI/CD or orchestrators) will advise external runners once GET /v1/augment/threshold is live.",
    },
    {
      title: "Push a commit",
      body: "CARF classifies the AST diff on every push. Live Status shows the dynamic error-rate threshold, soak window, and rollout outcome for that project. Standalone rollback is live today; additional platforms and augment integrations are planned.",
    },
  ],
};

export const GUIDE_PLATFORMS: PlatformGuide[] = [
  {
    id: "pm2",
    name: "PM2 (Node.js / VPS)",
    mode: "standalone",
    badge: "Standalone adapter (Live)",
    summary:
      "Zero-downtime cluster reload for Node apps on a VPS, EC2, or bare metal. CARF watches PM2 process health and reloads the previous release when the soak threshold is breached.",
    whenToUse:
      "Use this when the app already runs under PM2 in cluster mode and you want CARF to execute rollback directly.",
    steps: [
      {
        title: "Link the repo in Standalone mode",
        body: "On Live Status, link the project and set adapter kind to pm2. Target is the PM2 process name (for example api-server).",
      },
      {
        title: "Commit .carf.yml",
        body: "Linking writes .carf.yml to the repo. Confirm mode: standalone and adapter.kind: pm2 on the default branch.",
      },
      {
        title: "Run in cluster mode",
        body: "Use exec_mode: cluster and instances: max so pm2 reload cycles workers without dropping requests.",
      },
      {
        title: "Verify on Live Status",
        body: "Push a commit, watch the soak window, then confirm process status with pm2 jlist. A crash during soak should reload the previous release.",
      },
    ],
    carfYml: `version: "1.0"
mode: standalone
adapter:
  kind: pm2
  target: api-server
thresholds:
  base_tolerance_pct: 0.5
  observation_window_seconds: 300`,
    deploySnippetTitle: "ecosystem.config.cjs",
    deploySnippet: `module.exports = {
  apps: [{
    name: "api-server",
    script: "dist/index.js",
    instances: "max",
    exec_mode: "cluster",
    watch: false,
    env_production: { NODE_ENV: "production" }
  }]
};`,
  },
  {
    id: "render",
    name: "Render & Railway",
    mode: "augment",
    badge: "Augment / deploy hook (Planned)",
    summary:
      "Planned augment integration: PaaS web services will use CARF as an advisory gate. CI/CD queries GET /v1/augment/threshold, triggers a deploy hook, then soaks the health endpoint for the calibrated window.",
    whenToUse:
      "Planned for when Render or Railway owns the runtime and you promote via deploy hooks rather than a CARF-owned adapter (requires GET /v1/augment/threshold).",
    steps: [
      {
        title: "Link in Augment mode",
        body: "Same as any GitHub project. CARF records commits and thresholds without talking to Render’s API directly.",
      },
      {
        title: "Wire the deploy hook",
        body: "After classification, POST the Render deploy hook (or Railway equivalent) for that commit SHA.",
      },
      {
        title: "Soak /healthz",
        body: "Wait for the CARF observation window, then check the service health URL before calling the rollout clean.",
      },
    ],
    carfYml: `version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 1.0
  max_tolerance_pct: 3.5
  observation_window_seconds: 240`,
    deploySnippetTitle: "Deploy hook + soak (Planned)",
    deploySnippet: `# Planned: will query GET /v1/augment/threshold once live
curl -X POST "https://api.render.com/deploy/srv-xxxx?ref=$COMMIT_SHA"

RES=$(curl -s -H "Authorization: Bearer $CARF_API_KEY" \\
  "https://carf.indevs.in/v1/augment/threshold?owner=$OWNER&repo=$REPO&sha=$COMMIT_SHA")
WINDOW=$(echo "$RES" | jq -r '.window // 240')
sleep "$WINDOW"`,
  },
  {
    id: "kubernetes",
    name: "Kubernetes & Argo Rollouts",
    mode: "augment",
    badge: "Augment / analysis template (Planned)",
    summary:
      "Planned augment consumer: CARF does not execute kubectl rollbacks. Instead, external progressive delivery controllers like Argo Rollouts (or Flagger) query GET /v1/augment/threshold and use the returned dynamic budget as the canary analysis metric.",
    whenToUse:
      "Planned for Kubernetes clusters that already run progressive delivery. CARF supplies the per-commit ceiling; the external mesh or rollout controller aborts the canary.",
    steps: [
      {
        title: "Augment mode (Planned)",
        body: "Keep Kubernetes and Argo as external orchestrators. Point canary analysis at CARF dynamic thresholds instead of a static error rate.",
      },
      {
        title: "Add an AnalysisTemplate",
        body: "The planned webhook URL is https://carf.indevs.in/v1/augment/threshold?owner=<owner>&repo=<repo>&sha=<sha> with your installation API key.",
      },
      {
        title: "Reference it from the Rollout",
        body: "Each canary step queries CARF. A breach pauses or rolls back the ReplicaSet using Argo’s own native undo path.",
      },
    ],
    carfYml: `version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 2.5
  observation_window_seconds: 600`,
    deploySnippetTitle: "Argo Rollouts AnalysisTemplate (Planned)",
    deploySnippet: `# Planned: Argo Rollouts queries CARF augment endpoint
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: carf-canary-gate
spec:
  metrics:
  - name: carf-threshold
    interval: 30s
    web:
      url: "https://carf.indevs.in/v1/augment/threshold?owner={{args.owner}}&repo={{args.repo}}&sha={{args.commit-sha}}"
      headers:
      - name: Authorization
        value: "Bearer <CARF_API_KEY>"
      jsonPath: "{$.threshold}"`,
  },
  {
    id: "prometheus",
    name: "Prometheus & observability",
    mode: "augment",
    badge: "Metrics scrape (Optional)",
    summary:
      "Optional scrape of CARF core-api /metrics so Grafana or Datadog can chart commits analyzed, soak outcomes, and rollbacks. This is not a deploy adapter.",
    whenToUse:
      "Use this after a project is already linked and you want CARF’s own counters next to application SLOs.",
    steps: [
      {
        title: "Expose core-api metrics",
        body: "CARF core-api serves Prometheus text at GET /metrics on the API host.",
      },
      {
        title: "Add a scrape job",
        body: "Point Prometheus (or Grafana Alloy / Datadog) at that endpoint on a 15s interval.",
      },
      {
        title: "Join with app red metrics",
        body: "Use CARF soak windows as the observation period when graphing application error rate against the dynamic budget.",
      },
    ],
    carfYml: `# No adapter. Scrape core-api directly:
# GET https://carf.indevs.in/metrics`,
    deploySnippetTitle: "prometheus.yml scrape job",
    deploySnippet: `scrape_configs:
  - job_name: "carf-core-api"
    scrape_interval: 15s
    static_configs:
      - targets: ["carf.indevs.in"]`,
  },
];
