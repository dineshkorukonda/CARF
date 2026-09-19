"use client";

import { useState } from "react";
import {
  X,
  Check,
  Copy,
  Terminal,
  Server,
  Container,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Globe,
  ExternalLink,
  Code2,
  FileCode2,
} from "lucide-react";

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  installationId: string;
  repoName?: string;
}

type StackPreset = "pm2" | "vercel" | "render" | "docker" | "k8s";

interface PresetDetails {
  title: string;
  badge: string;
  icon: typeof Terminal;
  description: string;
  modeExplanation: string;
  carfYml: string;
  deploySnippetTitle: string;
  deploySnippet: string;
  verificationSteps: string[];
}

const PRESETS: Record<StackPreset, PresetDetails> = {
  pm2: {
    title: "PM2 Process Manager (Node.js / VPS)",
    badge: "Standalone or Augment",
    icon: Terminal,
    description:
      "Ideal for self-hosted Node.js servers, EC2, or VPS deployments running with PM2 and immutable release directories.",
    modeExplanation:
      "CARF dynamically tunes error tolerance for each commit. When deploying with PM2, CARF monitors `pm2 jlist` during the soak window and runs zero-downtime `pm2 reload` to the previous release if errors exceed threshold.",
    carfYml: `# .carf.yml (Place in repository root)
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5         # 0.5% base error tolerance for sensitive changes
  max_tolerance_pct: 3.5          # Up to 3.5% for minor UI/test edits
  observation_window_seconds: 300 # 5-minute soak window

rules:
  - name: sensitive-routes
    pattern: "src/{routes,controllers,auth}/**/*.{ts,js}"
    weight: 1.8
  - name: db-migrations
    pattern: "**/{migrations,prisma}/**"
    weight: 2.5
`,
    deploySnippetTitle: "PM2 Deployment Script (deploy.sh or CI)",
    deploySnippet: `#!/usr/bin/env bash
set -e

# 1. Fetch CARF dynamic risk threshold for new commit
COMMIT_SHA=$(git rev-parse HEAD)
CARF_DATA=$(curl -s "https://carf.indevs.in/v1/threshold?commit=\${COMMIT_SHA}")
THRESHOLD=$(echo "\$CARF_DATA" | jq -r '.finalThreshold // 0.03')
WINDOW=$(echo "\$CARF_DATA" | jq -r '.finalWindow // 300')

echo "🚀 Deploying \${COMMIT_SHA} (Tolerance: \${THRESHOLD}, Soak: \${WINDOW}s)..."

# 2. Build and reload with PM2
npm run build
pm2 reload api-server

# 3. Observe health for soak duration
sleep 5
if ! pm2 show api-server | grep -q "online"; then
  echo "🚨 Threshold breached or process crashed! Rolling back..."
  git checkout HEAD~1
  npm run build
  pm2 reload api-server
  exit 1
fi
echo "✅ Rollout verified stable."
`,
    verificationSteps: [
      "Commit `.carf.yml` to the root of your repository.",
      "Push a commit to GitHub — CARF will immediately classify the AST diff on the Live Status dashboard.",
      "Run your deployment script on your server or in CI.",
      "Simulate a failure (e.g. process crash) to verify automated rollback to previous release.",
    ],
  },
  vercel: {
    title: "Vercel (Next.js / Frontend / Serverless)",
    badge: "Advisory / Augment Mode",
    icon: Globe,
    description:
      "Designed for Vercel-hosted web applications, Next.js apps, and serverless functions where preview and production health checks are needed.",
    modeExplanation:
      "Vercel manages hosting automatically. CARF runs in Advisory/Augment mode: it assesses commit risk on every PR/push, surfaces risk alerts on your CARF Dashboard, and provides automated GitHub PR risk check badges.",
    carfYml: `# .carf.yml (Place in repository root)
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 4.0
  observation_window_seconds: 180

rules:
  - name: api-endpoints
    pattern: "src/app/api/**/*.{ts,js}"
    weight: 1.5
  - name: ui-components
    pattern: "src/components/**/*.{tsx,jsx}"
    weight: 0.2
`,
    deploySnippetTitle: ".github/workflows/vercel-carf-check.yml",
    deploySnippet: `name: Vercel CARF Risk & Health Check
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  carf-risk-assessment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Query CARF Risk Calibration
        run: |
          RES=$(curl -s "https://carf.indevs.in/v1/threshold?commit=\${{ github.sha }}")
          echo "CARF Analysis: \$RES"
          THRESHOLD=$(echo \$RES | jq -r '.finalThreshold')
          echo "Commit Risk Threshold: \$THRESHOLD"
          # View in dashboard at: https://carf.indevs.in/dashboard
`,
    verificationSteps: [
      "Add `.carf.yml` to your Vercel project repository.",
      "Push a PR — CARF calculates AST risk score without touching your Vercel production build.",
      "Check the Live Status dashboard to see the risk breakdown.",
      "If a rollback is needed on Vercel, run `vercel rollback` via CLI or Vercel dashboard.",
    ],
  },
  render: {
    title: "Render (Web Services & Background Workers)",
    badge: "Advisory / Augment Mode",
    icon: Server,
    description:
      "Designed for apps hosted on Render.com using Render Webhooks, Deploy Hooks, and health endpoint monitoring.",
    modeExplanation:
      "Render executes builds via Deploy Hooks. CARF calculates dynamic error budgets so you can monitor your Render `/healthz` endpoint for the calculated soak window before marking the release clean.",
    carfYml: `# .carf.yml (Place in repository root)
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 3.0
  observation_window_seconds: 240

rules:
  - name: backend-core
    pattern: "server/**/*.{ts,js,py,go}"
    weight: 1.6
`,
    deploySnippetTitle: "Render Deploy Script with CARF Soak Check",
    deploySnippet: `#!/usr/bin/env bash
# Trigger Render Deploy Hook
curl -X POST "https://api.render.com/deploy/srv-xxxx?key=yyyy"

# Fetch CARF threshold
RES=$(curl -s "https://carf.indevs.in/v1/threshold?commit=$(git rev-parse HEAD)")
WINDOW=$(echo \$RES | jq -r '.finalWindow // 240')

echo "Waiting \${WINDOW}s to soak Render service..."
sleep 15
# Verify Render service health endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://my-app.onrender.com/healthz)
if [ "\$HTTP_STATUS" -ne 200 ]; then
  echo "🚨 Render healthcheck failed (\$HTTP_STATUS). Check logs!"
  exit 1
fi
echo "✅ Render service healthy."
`,
    verificationSteps: [
      "Commit `.carf.yml` into your Render repository.",
      "Configure your Render Deploy Hook or CI action.",
      "Observe the Live Status tab on CARF dashboard as commits are pushed.",
    ],
  },
  docker: {
    title: "Docker Compose / Docker Swarm",
    badge: "Standalone or Augment",
    icon: Container,
    description:
      "For containerized applications deployed on Linux VMs or Docker Swarm clusters with tagged image releases.",
    modeExplanation:
      "CARF tracks container health via `docker compose ps` and can execute automated rollback by deploying the previous image tag (`IMAGE_TAG=<previousSha> docker compose up -d`).",
    carfYml: `# .carf.yml
version: "1.0"
mode: standalone
adapter:
  kind: dockerCompose
  target: web
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 3.5
  observation_window_seconds: 180
`,
    deploySnippetTitle: "docker-compose.yml snippet",
    deploySnippet: `services:
  web:
    image: my-registry/app:\${IMAGE_TAG:-latest}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3
`,
    verificationSteps: [
      "Ensure docker-compose uses `${IMAGE_TAG}` variable for images.",
      "Place `.carf.yml` in repository.",
      "Deploy new image and observe CARF watchdog monitoring.",
    ],
  },
  k8s: {
    title: "Kubernetes & Argo Rollouts",
    badge: "Augment / Webhook",
    icon: Layers,
    description:
      "For production Kubernetes clusters using Argo Rollouts or Flagger for progressive canary traffic routing.",
    modeExplanation:
      "Argo Rollouts queries CARF's `GET /v1/threshold?commit=$SHA` via an `AnalysisTemplate` webhook provider to dynamically set canary error tolerances for each release.",
    carfYml: `# .carf.yml
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 3.0
  observation_window_seconds: 300
`,
    deploySnippetTitle: "Argo Rollouts AnalysisTemplate",
    deploySnippet: `apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: carf-dynamic-threshold
spec:
  metrics:
  - name: carf-risk-budget
    provider:
      web:
        url: "https://carf.indevs.in/v1/threshold?commit={{args.commit-sha}}"
        jsonPath: "{$.finalThreshold}"
`,
    verificationSteps: [
      "Add `AnalysisTemplate` to your Kubernetes manifests.",
      "Reference `carf-dynamic-threshold` in your Rollout spec.",
      "Argo automatically queries CARF and adjusts canary sensitivity.",
    ],
  },
};

export function SetupGuideModal({
  isOpen,
  onClose,
  installationId,
  repoName,
}: SetupGuideModalProps) {
  const [selectedStack, setSelectedStack] = useState<StackPreset>("pm2");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const current = PRESETS[selectedStack];
  const Icon = current.icon;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                CARF Setup & Integration Guide
              </h2>
              <p className="text-xs text-slate-500">
                Choose your deployment stack to get customized configuration and workflow snippets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Stack Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-2 gap-1.5 overflow-x-auto">
          {(
            [
              { id: "pm2", label: "PM2 (Node.js/VPS)", icon: Terminal },
              { id: "vercel", label: "Vercel (Next.js)", icon: Globe },
              { id: "render", label: "Render", icon: Server },
              { id: "docker", label: "Docker Compose", icon: Container },
              { id: "k8s", label: "Kubernetes / Argo", icon: Layers },
            ] as const
          ).map((stack) => {
            const StackIcon = stack.icon;
            const isSelected = selectedStack === stack.id;
            return (
              <button
                key={stack.id}
                onClick={() => setSelectedStack(stack.id)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                }`}
              >
                <StackIcon className="size-4 shrink-0" />
                <span>{stack.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preset Overview */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Icon className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">{current.title}</h3>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                    {current.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{current.description}</p>
              </div>
            </div>
          </div>

          {/* Mode explanation */}
          <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-3.5 text-xs text-blue-900 leading-relaxed">
            <span className="font-semibold">How CARF works here: </span>
            {current.modeExplanation}
          </div>

          {/* Code Snippets (2 columns) */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* .carf.yml */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <FileCode2 className="size-4 text-blue-600" />
                  <span>Step 1: Add `.carf.yml`</span>
                </div>
                <button
                  onClick={() => handleCopy(current.carfYml, "yml")}
                  className="flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-xs"
                >
                  {copiedKey === "yml" ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{copiedKey === "yml" ? "Copied" : "Copy YAML"}</span>
                </button>
              </div>
              <pre className="flex-1 p-3.5 text-[11px] font-mono text-slate-800 bg-slate-900 text-slate-100 overflow-x-auto">
                <code>{current.carfYml}</code>
              </pre>
            </div>

            {/* Deploy Snippet */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Code2 className="size-4 text-indigo-600" />
                  <span>Step 2: {current.deploySnippetTitle}</span>
                </div>
                <button
                  onClick={() => handleCopy(current.deploySnippet, "deploy")}
                  className="flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-xs"
                >
                  {copiedKey === "deploy" ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{copiedKey === "deploy" ? "Copied" : "Copy Code"}</span>
                </button>
              </div>
              <pre className="flex-1 p-3.5 text-[11px] font-mono text-slate-100 bg-slate-900 overflow-x-auto">
                <code>{current.deploySnippet}</code>
              </pre>
            </div>
          </div>

          {/* Verification steps */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-xs font-semibold text-slate-900 mb-2.5 flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span>Step 3: Verification & Next Steps</span>
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {current.verificationSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <p className="text-xs text-slate-500">
            Need custom sensitivity rules? Visit the <strong>Threshold Rules</strong> tab anytime.
          </p>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
