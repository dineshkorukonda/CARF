"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  Copy,
  Download,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Server,
  Activity,
  ArrowRight,
  RefreshCw,
  Sliders,
  Check,
} from "lucide-react";

type IntegrationType =
  | "github_actions"
  | "argo_rollouts"
  | "flagger"
  | "generic_http"
  | "kubernetes"
  | "docker"
  | "systemd"
  | "prometheus";

interface IntegrationConfig {
  id: IntegrationType;
  title: string;
  badge: string;
  category: "CI/CD & Actions" | "Kubernetes Progressive" | "Host Runtime" | "Telemetry & SLO";
  description: string;
  prerequisites: string[];
  docsLink: string;
}

const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: "github_actions",
    title: "GitHub Actions + PM2",
    badge: "Official Action",
    category: "CI/CD & Actions",
    description: "Automated pre-deployment risk gating, live soak monitoring, and automated Actions rollback for Node.js / PM2 apps.",
    prerequisites: [
      "CARF GitHub App installed with Read & Write access",
      "CARF_API_KEY secret configured in repository settings",
      "PM2 running with named process or ecosystem.config.js",
      "Valid HTTP /healthz probe endpoint",
    ],
    docsLink: "/docs/integrations/github-actions-pm2.md",
  },
  {
    id: "argo_rollouts",
    title: "Argo Rollouts",
    badge: "Kubernetes CRD",
    category: "Kubernetes Progressive",
    description: "Cloud-native progressive canary analysis and blue/green automated rollbacks via CARF AnalysisTemplate.",
    prerequisites: [
      "Kubernetes cluster with Argo Rollouts controller v1.5+",
      "Argo Rollout CRD manifest referencing AnalysisTemplate",
      "Core-API reachable from Argo Rollouts controller pod",
    ],
    docsLink: "/docs/integrations/argo-rollouts.md",
  },
  {
    id: "flagger",
    title: "Flagger Canary",
    badge: "Service Mesh / Ingress",
    category: "Kubernetes Progressive",
    description: "Automate progressive traffic shifting and automated canary promotion or rollback using Flagger webhooks.",
    prerequisites: [
      "Flagger operator installed (Istio, Linkerd, Contour, or NGINX)",
      "Canary CRD with webhooks pointing to CARF /v1/report",
      "Deployment resource with target selector",
    ],
    docsLink: "/docs/integrations/flagger.md",
  },
  {
    id: "generic_http",
    title: "Generic CI & HTTP API",
    badge: "Universal Webhook",
    category: "CI/CD & Actions",
    description: "Integrate GitLab CI, Jenkins, Bitbucket Pipelines, or custom bash scripts via standard REST endpoints.",
    prerequisites: [
      "HTTP client (curl, wget, or fetch) in CI runner",
      "Authorization: Bearer <CARF_API_KEY> header",
      "Access to git commit SHA and diff metadata",
    ],
    docsLink: "/docs/integrations/generic-ci-http.md",
  },
  {
    id: "kubernetes",
    title: "Kubernetes kubectl",
    badge: "Native K8s",
    category: "Host Runtime",
    description: "In-cluster or agent-managed rollbacks using native kubectl rollout restart, undo, and pod readiness checks.",
    prerequisites: [
      "kubectl CLI configured with cluster context",
      "ServiceAccount with permissions on apps/deployments",
      "Configured Deployment name and namespace",
    ],
    docsLink: "/docs/integrations/kubernetes.md",
  },
  {
    id: "docker",
    title: "Docker Compose",
    badge: "Container Runtime",
    category: "Host Runtime",
    description: "Container runtime adapter inspecting container health status, restarts, and executing image tag rollbacks.",
    prerequisites: [
      "Docker daemon socket / compose v2 installed on host",
      "docker-compose.yml with named service and healthcheck",
      "Immutable container image tags (e.g. git SHA tag)",
    ],
    docsLink: "/docs/integrations/docker-compose.md",
  },
  {
    id: "systemd",
    title: "Linux systemd",
    badge: "Linux Services",
    category: "Host Runtime",
    description: "Native Linux service unit management with systemctl active status, journald error check, and git revision rollback.",
    prerequisites: [
      "Linux host running systemd / systemctl",
      "Service unit installed (e.g. /etc/systemd/system/app.service)",
      "User permission to execute systemctl restart <service>",
    ],
    docsLink: "/docs/integrations/systemd.md",
  },
  {
    id: "prometheus",
    title: "Prometheus PromQL",
    badge: "Telemetry Source",
    category: "Telemetry & SLO",
    description: "Authoritative health metric evaluation querying Prometheus or VictoriaMetrics instant query API with PromQL.",
    prerequisites: [
      "Prometheus or VictoriaMetrics server with HTTP v1 API",
      "PromQL query calculating HTTP error rate or latency",
      "Network connectivity between CARF and Prometheus",
    ],
    docsLink: "/docs/integrations/prometheus.md",
  },
];

export default function IntegrationsPage() {
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationType>("github_actions");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Manifest Generator Form States
  const [apiUrl, setApiUrl] = useState("https://api.carf.dev");
  const [apiKey, setApiKey] = useState("carf_live_sec_9f82d1ab34e");
  const [targetName, setTargetName] = useState("production-api");
  const [healthUrl, setHealthUrl] = useState("http://localhost:3000/healthz");
  const [branch, setBranch] = useState("main");
  const [repoSlug, setRepoSlug] = useState("acme/production-service");
  const [activeManifestTab, setActiveManifestTab] = useState<"carf_yml" | "pipeline">("carf_yml");

  // Simulator States
  const [simulationMode, setSimulationMode] = useState<"success" | "rollback">("success");
  const [simRunning, setSimRunning] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [simLogs, setSimLogs] = useState<Array<{ step: string; status: "success" | "warning" | "error"; data: unknown }>>([]);

  const activeIntegration = INTEGRATIONS.find((i) => i.id === selectedIntegration)!;

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Live Generator Logic
  function generateCarfYml(): string {
    switch (selectedIntegration) {
      case "github_actions":
        return `# .carf.yml - CARF Automated Rollback Configuration
version: "1.0"
mode: "augment" # Actions + PM2 gating mode
target:
  runtime: "pm2"
  name: "${targetName}"
  health_url: "${healthUrl}"
rules:
  window_seconds: 300
  base_ceiling: 0.05
  soak_duration: 180
ci:
  workflow_name: "CI"
  trigger_on_push: true
`;
      case "argo_rollouts":
        return `# .carf.yml - Argo Rollouts Progressive Delivery
version: "1.0"
mode: "augment"
target:
  runtime: "kubernetes"
  name: "${targetName}"
  namespace: "default"
rules:
  window_seconds: 180
  base_ceiling: 0.02
  max_consecutive_failures: 2
`;
      case "flagger":
        return `# .carf.yml - Flagger Canary Delivery
version: "1.0"
mode: "augment"
target:
  runtime: "kubernetes"
  name: "${targetName}"
rules:
  window_seconds: 120
  base_ceiling: 0.03
`;
      case "kubernetes":
        return `# .carf.yml - Kubernetes Rollback Adapter
version: "1.0"
mode: "standalone"
target:
  runtime: "kubernetes"
  deployment: "${targetName}"
  namespace: "default"
  health_url: "${healthUrl}"
rules:
  window_seconds: 300
  base_ceiling: 0.05
`;
      case "docker":
        return `# .carf.yml - Docker Compose Runtime Adapter
version: "1.0"
mode: "standalone"
target:
  runtime: "docker"
  container: "${targetName}"
  compose_file: "docker-compose.yml"
  health_url: "${healthUrl}"
rules:
  window_seconds: 300
  base_ceiling: 0.05
`;
      case "systemd":
        return `# .carf.yml - Linux systemd Service Adapter
version: "1.0"
mode: "standalone"
target:
  runtime: "systemd"
  service: "${targetName}.service"
  health_url: "${healthUrl}"
  working_directory: "/var/www/${targetName}"
rules:
  window_seconds: 240
  base_ceiling: 0.04
`;
      case "prometheus":
        return `# .carf.yml - Prometheus Telemetry Health Source
version: "1.0"
mode: "augment"
telemetry:
  source: "prometheus"
  endpoint: "http://prometheus:9090"
  query: 'sum(rate(http_requests_total{service="${targetName}",status=~"5.."}[1m])) / sum(rate(http_requests_total{service="${targetName}"}[1m]))'
rules:
  window_seconds: 300
  base_ceiling: 0.02
`;
      case "generic_http":
      default:
        return `# .carf.yml - Generic HTTP CI Integration
version: "1.0"
mode: "augment"
target:
  name: "${targetName}"
  health_url: "${healthUrl}"
rules:
  window_seconds: 300
  base_ceiling: 0.05
`;
    }
  }

  function generatePipelineManifest(): { filename: string; content: string } {
    switch (selectedIntegration) {
      case "github_actions":
        return {
          filename: ".github/workflows/carf.yml",
          content: `name: CARF Deployment & Rollback Gating
on:
  push:
    branches: [ ${branch} ]
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [ ${branch} ]

jobs:
  carf-gate:
    runs-on: ubuntu-latest
    if: \${{ github.event_name == 'push' || github.event.workflow_run.conclusion == 'success' }}
    steps:
      - uses: actions/checkout@v4
      - name: Evaluate CARF Dynamic Risk Threshold
        id: carf_threshold
        run: |
          RESP=$(curl -s -f -X GET \\
            -H "Authorization: Bearer \${{ secrets.CARF_API_KEY }}" \\
            "${apiUrl}/v1/augment/threshold?owner=\${{ github.repository_owner }}&repo=\${{ github.event.repository.name }}&sha=\${{ github.sha }}")
          echo "threshold=$(echo $RESP | jq -r .threshold)" >> $GITHUB_OUTPUT
          echo "soak_seconds=$(echo $RESP | jq -r .soakWindowSeconds)" >> $GITHUB_OUTPUT

      - name: Deploy to Host (PM2 Reload)
        run: |
          pm2 reload ${targetName} --update-env

      - name: CARF Soak & Automated Health Monitor
        run: |
          curl -s -f -X POST "${apiUrl}/v1/report" \\
            -H "Authorization: Bearer \${{ secrets.CARF_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "sha": "\${{ github.sha }}",
              "errorRate": 0.0,
              "healthy": true
            }'
`,
        };

      case "argo_rollouts":
        return {
          filename: "carf-analysis-template.yaml",
          content: `apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: carf-canary-metric
  namespace: default
spec:
  metrics:
  - name: carf-evaluation
    interval: 30s
    successCondition: result == "continue"
    failureLimit: 2
    provider:
      web:
        url: "${apiUrl}/v1/report"
        headers:
        - key: Authorization
          value: "Bearer ${apiKey}"
        - key: Content-Type
          value: "application/json"
        jsonBody:
          sha: "{{args.target-sha}}"
          errorRate: 0.0
          healthy: true
`,
        };

      case "flagger":
        return {
          filename: "flagger-canary.yaml",
          content: `apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: ${targetName}
  namespace: default
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${targetName}
  analysis:
    interval: 1m
    threshold: 2
    maxWeight: 50
    stepWeight: 10
    webhooks:
      - name: "carf-soak-verification"
        type: rollout
        url: "${apiUrl}/v1/report"
        timeout: 10s
        headers:
          Authorization: "Bearer ${apiKey}"
`,
        };

      case "generic_http":
        return {
          filename: ".gitlab-ci.yml",
          content: `stages:
  - test
  - carf_gate
  - deploy

carf_risk_evaluation:
  stage: carf_gate
  image: curlimages/curl:latest
  script:
    - |
      echo "Querying CARF dynamic risk ceiling..."
      CEILING=$(curl -s -f -H "Authorization: Bearer $CARF_API_KEY" \\
        "${apiUrl}/v1/augment/threshold?owner=${repoSlug.split("/")[0]}&repo=${repoSlug.split("/")[1]}&sha=$CI_COMMIT_SHA" | jq -r .threshold)
      echo "Calibrated threshold ceiling: $CEILING"
`,
        };

      case "kubernetes":
        return {
          filename: "k8s-rollback-job.yaml",
          content: `apiVersion: batch/v1
kind: Job
metadata:
  name: carf-rollback-${targetName}
spec:
  template:
    spec:
      serviceAccountName: carf-operator
      containers:
      - name: rollback
        image: bitnami/kubectl:latest
        command: ["kubectl", "rollout", "undo", "deployment/${targetName}"]
      restartPolicy: Never
`,
        };

      case "docker":
        return {
          filename: "docker-compose.override.yml",
          content: `version: "3.8"
services:
  ${targetName}:
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "${healthUrl}"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
`,
        };

      case "systemd":
        return {
          filename: `${targetName}.service`,
          content: `[Unit]
Description=CARF Managed Service - ${targetName}
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/var/www/${targetName}
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5s
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
`,
        };

      case "prometheus":
        return {
          filename: "prometheus-rules.yml",
          content: `groups:
- name: carf_slo_rules
  rules:
  - record: carf:http_error_rate:5m
    expr: |
      sum(rate(http_requests_total{service="${targetName}",status=~"5.."}[5m]))
      /
      sum(rate(http_requests_total{service="${targetName}"}[5m]))
`,
        };
    }
  }

  // Interactive Live Simulator Runner
  async function runSimulation() {
    setSimRunning(true);
    setSimStep(1);
    setSimLogs([]);

    // Step 1: Healthcheck & Auth Probe
    await new Promise((r) => setTimeout(r, 600));
    setSimLogs((prev) => [
      ...prev,
      {
        step: "Step 1: Endpoint & Auth Probe",
        status: "success",
        data: {
          request: `GET ${apiUrl}/healthz`,
          headers: { Authorization: `Bearer ${apiKey.slice(0, 10)}...` },
          response: { status: 200, healthy: true, service: "carf-core-api", version: "1.4.0" },
        },
      },
    ]);

    // Step 2: Commit Classification
    setSimStep(2);
    await new Promise((r) => setTimeout(r, 700));
    const churnTier = simulationMode === "rollback" ? "HIGH_RISK" : "STANDARD_RELEASE";
    setSimLogs((prev) => [
      ...prev,
      {
        step: "Step 2: Commit Churn Vector & AST Analysis",
        status: simulationMode === "rollback" ? "warning" : "success",
        data: {
          request: `POST ${apiUrl}/v1/commits/refresh`,
          payload: { commit: "b7a89f3", branch, repo: repoSlug },
          classification: {
            riskTier: churnTier,
            complexityScore: simulationMode === "rollback" ? 88.5 : 24.2,
            treeSitterChurn: simulationMode === "rollback" ? 412 : 38,
            confidence: 0.94,
          },
        },
      },
    ]);

    // Step 3: Threshold Calibration
    setSimStep(3);
    await new Promise((r) => setTimeout(r, 800));
    const dynamicCeiling = simulationMode === "rollback" ? 0.015 : 0.05;
    const soakWindow = simulationMode === "rollback" ? 360 : 180;
    setSimLogs((prev) => [
      ...prev,
      {
        step: "Step 3: Dynamic Threshold & Soak Calibration",
        status: "success",
        data: {
          request: `GET ${apiUrl}/v1/augment/threshold?sha=b7a89f3`,
          calibratedPolicy: {
            thresholdCeiling: dynamicCeiling,
            soakWindowSeconds: soakWindow,
            recommendation: simulationMode === "rollback" ? "TIGHTEN_GATING" : "NORMAL_RELEASE",
          },
        },
      },
    ]);

    // Step 4: Health Check & Rollback Decision
    setSimStep(4);
    await new Promise((r) => setTimeout(r, 900));
    if (simulationMode === "success") {
      setSimLogs((prev) => [
        ...prev,
        {
          step: "Step 4: Soak Monitoring & Promotion",
          status: "success",
          data: {
            request: `POST ${apiUrl}/v1/report`,
            measuredErrorRate: 0.002,
            threshold: dynamicCeiling,
            decision: "CONTINUE_DEPLOYMENT",
            action: "Promoted to 100% production traffic. No rollback needed.",
          },
        },
      ]);
    } else {
      setSimLogs((prev) => [
        ...prev,
        {
          step: "Step 4: Breach Detected -> Automated Rollback Triggered",
          status: "error",
          data: {
            request: `POST ${apiUrl}/v1/report`,
            measuredErrorRate: 0.098,
            thresholdCeiling: dynamicCeiling,
            decision: "ROLLBACK_TRIGGERED",
            recoveryExecution: {
              adapter: selectedIntegration,
              action: `Atomic rollback executed for ${targetName}. Previous revision restored.`,
              verificationResult: "ROLLBACK_VERIFIED",
              postRollbackErrorRate: 0.0,
            },
          },
        },
      ]);
    }

    setSimRunning(false);
  }

  const manifest = generatePipelineManifest();
  const carfYml = generateCarfYml();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-primary/10 text-primary">
              <Layers className="size-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Interactive Integrations Center</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore architecture, generate tailored configurations, and simulate live rollouts for all 8 deployment & runtime targets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md border border-border hover:bg-muted text-foreground transition-colors"
          >
            <Sliders className="size-3.5" />
            <span>Manage API Keys</span>
          </Link>
          <a
            href="https://github.com/dineshkorukonda/CARF"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="size-3.5" />
            <span>GitHub Repository</span>
          </a>
        </div>
      </div>

      {/* Integration Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {INTEGRATIONS.map((item) => {
          const isSelected = item.id === selectedIntegration;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedIntegration(item.id)}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 text-primary shadow-xs ring-1 ring-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              <span className="text-xs font-semibold truncate w-full">{item.title}</span>
              <span className="mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted/80 text-muted-foreground uppercase font-medium">
                {item.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Left Guide & Generator, Right Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Integration Details & Configuration Generator (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Header Card */}
          <div className="p-5 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                  {activeIntegration.category}
                </span>
                <h2 className="text-xl font-bold text-foreground mt-0.5">{activeIntegration.title}</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Production Ready
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{activeIntegration.description}</p>

            {/* Prerequisites */}
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Prerequisites</h3>
              <ul className="space-y-1.5">
                {activeIntegration.prerequisites.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Dynamic Configuration Generator Form (Issue #212) */}
          <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Dynamic Manifest Generator</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">Auto-updates manifests in real time</span>
            </div>

            {/* Input Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">CARF Core API URL</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Target Service / Workload</label>
                <input
                  type="text"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Healthcheck Probe URL</label>
                <input
                  type="text"
                  value={healthUrl}
                  onChange={(e) => setHealthUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Deployment Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>
            </div>

            {/* Manifest Code Viewer Tabs */}
            <div className="mt-2 flex flex-col rounded-lg border border-border bg-muted/30 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveManifestTab("carf_yml")}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                      activeManifestTab === "carf_yml"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    .carf.yml
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveManifestTab("pipeline")}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                      activeManifestTab === "pipeline"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {manifest.filename}
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        activeManifestTab === "carf_yml" ? carfYml : manifest.content,
                        activeManifestTab
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors"
                  >
                    {copiedKey === activeManifestTab ? (
                      <>
                        <Check className="size-3 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        activeManifestTab === "carf_yml" ? ".carf.yml" : manifest.filename,
                        activeManifestTab === "carf_yml" ? carfYml : manifest.content
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors"
                  >
                    <Download className="size-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 text-[11px] font-mono text-foreground overflow-x-auto whitespace-pre leading-relaxed max-h-72">
                {activeManifestTab === "carf_yml" ? carfYml : manifest.content}
              </pre>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive End-to-End Simulator (Issue #213) (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="p-5 rounded-xl border border-border bg-card flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Interactive Integration Simulator</h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                Live Playground
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Simulate live request/response flows between your integration runner, CARF risk engine, and recovery adapters.
            </p>

            {/* Simulation Scenario Selector */}
            <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setSimulationMode("success")}
                className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold text-center transition-all ${
                  simulationMode === "success"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Normal Release (Promote)
              </button>
              <button
                type="button"
                onClick={() => setSimulationMode("rollback")}
                className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold text-center transition-all ${
                  simulationMode === "rollback"
                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                High Risk (Auto-Rollback)
              </button>
            </div>

            {/* Run Button */}
            <button
              type="button"
              onClick={runSimulation}
              disabled={simRunning}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                simRunning
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              }`}
            >
              {simRunning ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Simulating Integration Flow (Step {simStep}/4)...</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5 fill-current" />
                  <span>Run Live Simulation</span>
                </>
              )}
            </button>

            {/* Simulation Step Progress */}
            <div className="grid grid-cols-4 gap-1.5 text-center mt-1">
              {[
                { num: 1, label: "Auth Probe" },
                { num: 2, label: "Risk Score" },
                { num: 3, label: "Threshold" },
                { num: 4, label: simulationMode === "rollback" ? "Rollback" : "Promote" },
              ].map((s) => {
                const isActive = simStep === s.num;
                const isDone = simStep > s.num || (!simRunning && simLogs.length === 4);
                return (
                  <div
                    key={s.num}
                    className={`py-1.5 px-1 rounded text-[10px] font-semibold border transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary animate-pulse"
                        : isDone
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500"
                        : "border-border bg-muted/20 text-muted-foreground"
                    }`}
                  >
                    <span>{s.num}. {s.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Live JSON Inspector / Logs */}
            <div className="mt-2 flex flex-col rounded-lg border border-border bg-background overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
                  <Terminal className="size-3" />
                  <span>Live Telemetry & Response Inspector</span>
                </span>
                {simLogs.length > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-500">
                    {simLogs.length} events recorded
                  </span>
                )}
              </div>

              <div className="p-3 text-[11px] font-mono space-y-3 max-h-80 overflow-y-auto">
                {simLogs.length === 0 ? (
                  <p className="text-muted-foreground italic text-center py-6">
                    Click &quot;Run Live Simulation&quot; to test your configuration end-to-end.
                  </p>
                ) : (
                  simLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded border text-xs leading-relaxed ${
                        log.status === "error"
                          ? "border-red-500/30 bg-red-500/5 text-red-400"
                          : log.status === "warning"
                          ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
                          : "border-border bg-muted/20 text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold mb-1">
                        <span>{log.step}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                            log.status === "error"
                              ? "bg-red-500/20 text-red-400"
                              : log.status === "warning"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <pre className="text-[10px] overflow-x-auto whitespace-pre">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
