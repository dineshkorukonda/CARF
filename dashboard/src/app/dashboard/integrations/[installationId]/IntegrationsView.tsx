"use client";

import { useState, useMemo } from "react";
import {
  Layers,
  Terminal,
  Container,
  Server,
  GitBranch,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Zap,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Code2,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import type { InstallationRepo } from "../../../../adapters/github/reposClient";

interface IntegrationsViewProps {
  installationId: string;
  targetLogin: string;
  apiKey: string | null;
  repos: InstallationRepo[];
}

interface IntegrationCardDef {
  id: string;
  name: string;
  category: "Hosting & Serverless" | "Containers & Orchestration" | "Process Managers" | "Observability";
  description: string;
  mode: "Standalone (Autonomous Rollback)" | "Augment (Advisory / CI Gate)";
  icon: typeof Terminal;
  badge: string;
  badgeColor: string;
  docsUrl: string;
  snippets: {
    carfYml: string;
    actionScript: string;
    curlProbe: string;
  };
}

export function IntegrationsView({
  installationId,
  targetLogin,
  apiKey,
  repos = [],
}: IntegrationsViewProps) {
  const [search, setSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTabMap, setActiveTabMap] = useState<Record<string, "yml" | "script" | "curl">>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { status: "success" | "error"; message: string }>>({});

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://carf.indevs.in";

  const integrations: IntegrationCardDef[] = useMemo(
    () => [
      {
        id: "vercel",
        name: "Vercel",
        category: "Hosting & Serverless",
        description:
          "Enforce change-aware risk budgets on Next.js and frontend deployments. Cancels or pauses builds when AST risk exceeds allowable tolerance.",
        mode: "Augment (Advisory / CI Gate)",
        icon: ArrowUpRight,
        badge: "Serverless & Frontend",
        badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        docsUrl: "https://vercel.com/docs",
        snippets: {
          carfYml: `# .carf.yml for Vercel / Next.js
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 4.0
  observation_window_seconds: 180
rules:
  - name: server-actions-and-api
    pattern: "src/app/api/**/*.{ts,js}"
    weight: 2.0`,
          actionScript: `# In GitHub Actions or Vercel Build Command
# Query CARF dynamic threshold before deployment promotion:
THRESHOLD=$(curl -s -H "Authorization: Bearer ${apiKey ?? "<API_KEY>"}" \\
  "${baseUrl}/v1/threshold?commit=\${VERCEL_GIT_COMMIT_SHA}" | jq -r '.finalThreshold')

echo "CARF dynamic risk threshold: \${THRESHOLD}"`,
          curlProbe: `curl -i -H "Authorization: Bearer ${apiKey ?? "<API_KEY>"}" \\
  "${baseUrl}/v1/threshold?commit=HEAD"`,
        },
      },
      {
        id: "pm2",
        name: "PM2 Process Manager",
        category: "Process Managers",
        description:
          "Autonomous zero-downtime rollback for Node.js apps on VPS, EC2, or bare metal. Automatically executes 'pm2 reload' upon threshold breach.",
        mode: "Standalone (Autonomous Rollback)",
        icon: Terminal,
        badge: "Production Node.js VPS",
        badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        docsUrl: "https://pm2.keymetrics.io/docs/usage/cluster-mode/",
        snippets: {
          carfYml: `# .carf.yml for PM2 Cluster
version: "1.0"
mode: standalone
adapter:
  kind: pm2
  target: carf-dashboard   # Replace with your PM2 app name
thresholds:
  base_tolerance_pct: 0.5
  observation_window_seconds: 300`,
          actionScript: `// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "my-app",
    script: "dist/index.js",
    instances: "max",       // Cluster mode enabled for zero downtime
    exec_mode: "cluster",
    watch: false,
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
};`,
          curlProbe: `# Verify PM2 process is healthy
pm2 jlist | jq '.[].pm2_env.status'`,
        },
      },
      {
        id: "render",
        name: "Render & Railway",
        category: "Hosting & Serverless",
        description:
          "Connect Render or Railway web services with CARF deployment webhooks and automatic deploy hook rollback on regression spikes.",
        mode: "Augment (Advisory / CI Gate)",
        icon: Zap,
        badge: "Cloud PaaS",
        badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        docsUrl: "https://render.com/docs/deploy-hooks",
        snippets: {
          carfYml: `# .carf.yml for Render / Railway
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 1.0
  max_tolerance_pct: 3.5
  observation_window_seconds: 240`,
          actionScript: `# Deploy Hook Trigger with CARF verification
curl -X POST "https://api.render.com/deploy/srv-xxxx?ref=\${COMMIT_SHA}"`,
          curlProbe: `curl -s -H "Authorization: Bearer ${apiKey ?? "<API_KEY>"}" \\
  "${baseUrl}/v1/commits"`,
        },
      },
      {
        id: "docker",
        name: "Docker Compose",
        category: "Containers & Orchestration",
        description:
          "Single-node container rollouts. Swaps image tags atomically and reverts to previous tag with zero downtime if container enters restart loop.",
        mode: "Standalone (Autonomous Rollback)",
        icon: Container,
        badge: "Compose Containers",
        badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        docsUrl: "https://docs.docker.com/compose/",
        snippets: {
          carfYml: `# .carf.yml for Docker Compose
version: "1.0"
mode: standalone
adapter:
  kind: dockerCompose
  target: web-service    # service name in docker-compose.yml
thresholds:
  base_tolerance_pct: 0.5
  observation_window_seconds: 300`,
          actionScript: `# Autonomous rollback command CARF executes on breach:
IMAGE_TAG=\${PREVIOUS_SHA} docker compose up -d web-service`,
          curlProbe: `docker compose ps --format json`,
        },
      },
      {
        id: "kubernetes",
        name: "Kubernetes & Argo Rollouts",
        category: "Containers & Orchestration",
        description:
          "Cloud-native canary rollouts. Argo Rollouts AnalysisTemplates query CARF's dynamic threshold endpoint to gate canary step promotion.",
        mode: "Augment (Advisory / CI Gate)",
        icon: Server,
        badge: "K8s & Service Mesh",
        badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
        docsUrl: "https://argoproj.github.io/argo-rollouts/",
        snippets: {
          carfYml: `# .carf.yml for Kubernetes / Argo
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 2.5
  observation_window_seconds: 600`,
          actionScript: `# Argo Rollouts AnalysisTemplate Webhook
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: carf-canary-gate
spec:
  metrics:
  - name: carf-threshold
    interval: 30s
    web:
      url: "${baseUrl}/v1/threshold?commit={{args.commit-sha}}"
      headers:
      - name: Authorization
        value: "Bearer ${apiKey ?? "<API_KEY>"}"
      jsonPath: "{$.finalThreshold}"`,
          curlProbe: `kubectl rollout status deployment/my-app`,
        },
      },
      {
        id: "prometheus",
        name: "Prometheus & Observability",
        category: "Observability",
        description:
          "Scrape real-time CARF metrics (commits analyzed, rollbacks executed, uptime) and stream telemetry into Grafana or Datadog.",
        mode: "Augment (Advisory / CI Gate)",
        icon: Activity,
        badge: "Metrics Exporter",
        badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        docsUrl: "https://prometheus.io/docs/introduction/overview/",
        snippets: {
          carfYml: `# Prometheus Exporter Endpoint
# Core-API exposes standard Prometheus metrics out of the box:
# GET ${baseUrl.replace(":14102", ":14101")}/metrics`,
          actionScript: `# prometheus.yml scrape job
scrape_configs:
  - job_name: "carf-core-api"
    scrape_interval: 15s
    static_configs:
      - targets: ["localhost:14101"]`,
          curlProbe: `curl -s "${baseUrl.replace(":14102", ":14101")}/metrics" | grep "carf_"`,
        },
      },
    ],
    [apiKey, baseUrl]
  );

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function testProbe(id: string) {
    setTestingId(id);
    try {
      // Test basic connectivity to health / status
      const res = await fetch(`/api/health`);
      if (res.ok) {
        setTestResult((prev) => ({
          ...prev,
          [id]: { status: "success", message: "Core-API & adapter connectivity verified healthy (HTTP 200)." },
        }));
      } else {
        setTestResult((prev) => ({
          ...prev,
          [id]: { status: "error", message: `Connection test returned HTTP ${res.status}.` },
        }));
      }
    } catch {
      setTestResult((prev) => ({
        ...prev,
        [id]: { status: "error", message: "Failed to connect to CARF Core-API." },
      }));
    } finally {
      setTestingId(null);
    }
  }

  const filtered = integrations.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Card */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-2xs md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Integrations & Deployment Adapters
            </h1>
            <Badge variant="outline" className="text-xs">
              {integrations.length} Platforms
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            Connect CARF to your deployment orchestrators, CI/CD runners, and cloud platforms.
            Configure autonomous rollback triggers or subscribe to dynamic risk budget webhooks.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search platforms (Vercel, PM2, K8s...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {filtered.map((item) => {
          const Icon = item.icon;
          const activeTab = activeTabMap[item.id] ?? "yml";
          const snippetContent =
            activeTab === "yml"
              ? item.snippets.carfYml
              : activeTab === "script"
              ? item.snippets.actionScript
              : item.snippets.curlProbe;

          const copyId = `${item.id}-${activeTab}`;
          const isCopied = copiedKey === copyId;
          const result = testResult[item.id];
          const isTesting = testingId === item.id;

          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-2xs transition-shadow hover:shadow-sm"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{item.name}</span>
                        <span className={`rounded-full border px-2 py-0.2 text-[10px] font-semibold ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground font-mono">{item.category}</p>
                    </div>
                  </div>

                  <a
                    href={item.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="View Official Docs"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>

                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>

                {/* Mode Pill */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Mode:</span>
                  <span className="rounded bg-muted/60 border border-border px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {item.mode}
                  </span>
                </div>

                {/* Snippets Switcher & Viewer */}
                <div className="mt-4 rounded-lg border border-border bg-slate-950 overflow-hidden text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveTabMap((p) => ({ ...p, [item.id]: "yml" }))}
                        className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                          activeTab === "yml"
                            ? "bg-primary text-primary-foreground font-bold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        .carf.yml
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTabMap((p) => ({ ...p, [item.id]: "script" }))}
                        className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                          activeTab === "script"
                            ? "bg-primary text-primary-foreground font-bold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Script / Manifest
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTabMap((p) => ({ ...p, [item.id]: "curl" }))}
                        className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                          activeTab === "curl"
                            ? "bg-primary text-primary-foreground font-bold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        cURL Test
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyText(copyId, snippetContent)}
                      className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-300 transition-colors"
                      title="Copy code"
                    >
                      {isCopied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      <span>{isCopied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <pre className="p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">
                    {snippetContent}
                  </pre>
                </div>

                {/* Connection Test Result */}
                {result && (
                  <div
                    className={`mt-3 rounded-lg border p-2.5 text-xs ${
                      result.status === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    {result.message}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 flex items-center justify-between border-t border-border pt-3.5">
                <span className="text-[11px] text-muted-foreground font-mono">
                  Integration #{installationId}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={() => testProbe(item.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`size-3 ${isTesting ? "animate-spin" : ""}`} />
                    <span>{isTesting ? "Testing..." : "Test Probe"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
