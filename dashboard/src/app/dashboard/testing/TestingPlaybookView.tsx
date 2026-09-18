"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Terminal,
  Cloud,
  Server,
  Zap,
  Boxes,
  Copy,
  Check,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  GitBranch,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import type { InstallationRow } from "../../../lib/accountService";

interface TestingPlaybookViewProps {
  installations: InstallationRow[];
  accountEmail: string;
}

type TabKey = "local-vs-hosted" | "serverless" | "pm2" | "containers";

export function TestingPlaybookView({
  installations,
}: TestingPlaybookViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("local-vs-hosted");
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [selectedInstallationId, setSelectedInstallationId] = useState<string>(
    installations[0]?.installationId ?? "demo-installation-12345"
  );

  const selectedInstallation = installations.find(
    (i) => i.installationId === selectedInstallationId
  );
  const effectiveApiKey = selectedInstallation?.coreApiKey ?? "carf_live_demo_key_abcdef123456";

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMap((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedMap((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <BookOpen className="size-3.5" />
            <span>Developer Testing & Deployment Playbook</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Testing CARF Across Project Architectures
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Step-by-step instructions to test dynamic error thresholds and zero-downtime rollbacks on
            Local vs Hosted environments, Serverless functions, PM2 process trees, and Containers.
          </p>
        </div>

        {installations.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Integration Context:</span>
            <select
              value={selectedInstallationId}
              onChange={(e) => setSelectedInstallationId(e.target.value)}
              aria-label="Integration Context"
              className="rounded-sm border border-border bg-card px-2.5 py-1 text-xs font-mono text-foreground focus:outline-hidden"
            >
              {installations.map((inst) => (
                <option key={inst.id} value={inst.installationId}>
                  @{inst.targetLogin} (#{inst.installationId})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Primary Navigation Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-border pb-4">
        <button
          onClick={() => setActiveTab("local-vs-hosted")}
          className={`flex items-center gap-2 rounded-sm px-3.5 py-2.5 text-xs font-medium border transition-colors ${
            activeTab === "local-vs-hosted"
              ? "border-primary bg-primary/10 text-foreground font-semibold shadow-2xs"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Terminal className="size-4 text-emerald-500 shrink-0" />
          <span>Local vs Hosted</span>
        </button>

        <button
          onClick={() => setActiveTab("serverless")}
          className={`flex items-center gap-2 rounded-sm px-3.5 py-2.5 text-xs font-medium border transition-colors ${
            activeTab === "serverless"
              ? "border-primary bg-primary/10 text-foreground font-semibold shadow-2xs"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Zap className="size-4 text-amber-500 shrink-0" />
          <span>Serverless Apps</span>
        </button>

        <button
          onClick={() => setActiveTab("pm2")}
          className={`flex items-center gap-2 rounded-sm px-3.5 py-2.5 text-xs font-medium border transition-colors ${
            activeTab === "pm2"
              ? "border-primary bg-primary/10 text-foreground font-semibold shadow-2xs"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Server className="size-4 text-indigo-500 shrink-0" />
          <span>PM2 Process Manager</span>
        </button>

        <button
          onClick={() => setActiveTab("containers")}
          className={`flex items-center gap-2 rounded-sm px-3.5 py-2.5 text-xs font-medium border transition-colors ${
            activeTab === "containers"
              ? "border-primary bg-primary/10 text-foreground font-semibold shadow-2xs"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Boxes className="size-4 text-blue-500 shrink-0" />
          <span>Docker & K8s</span>
        </button>
      </div>

      {/* Tab 1: Local vs Hosted Testing */}
      {activeTab === "local-vs-hosted" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local / Self-Hosted */}
            <div className="rounded-sm border border-border bg-card p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-emerald-500" />
                  <h2 className="text-sm font-semibold text-foreground">Local / Self-Hosted Project</h2>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">Development</Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Test CARF locally without configuring GitHub Webhooks or cloud credentials. You run <code className="font-mono text-foreground">core-api</code> locally, query endpoints with curl, and test Tree-sitter diff scoring directly.
              </p>

              <div className="space-y-3 pt-1 text-xs">
                <div>
                  <span className="font-semibold text-foreground">Step 1: Start local core-api</span>
                  <div className="relative mt-1">
                    <pre className="rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
                      {`cd core-api\nnpm install\nnpm run dev`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(`cd core-api\nnpm install\nnpm run dev`, "step1-local")}
                      className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                      title="Copy command"
                    >
                      {copiedMap["step1-local"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-foreground">Step 2: Query Threshold (No Auth Required for Local)</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Commits without a GitHub App installation ID return 200 unauthenticated with default or cached thresholds:
                  </p>
                  <div className="relative mt-1">
                    <pre className="rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
                      {`curl -s "http://localhost:3000/v1/threshold?commit=HEAD" | jq .`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(`curl -s "http://localhost:3000/v1/threshold?commit=HEAD" | jq .`, "step2-local")}
                      className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                      title="Copy command"
                    >
                      {copiedMap["step2-local"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-foreground">Step 3: Test Tree-sitter Diff Complexity Offline</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    You can simulate git diff classification using the offline evaluation endpoint:
                  </p>
                  <div className="relative mt-1">
                    <pre className="rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
                      {`curl -X POST "http://localhost:3000/v1/eval/simulate" \\
  -H "Content-Type: application/json" \\
  -d '{"files": ["src/index.ts", "prisma/schema.prisma"], "cyclomaticDelta": 4}'`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(`curl -X POST "http://localhost:3000/v1/eval/simulate" -H "Content-Type: application/json" -d '{"files": ["src/index.ts", "prisma/schema.prisma"], "cyclomaticDelta": 4}'`, "step3-local")}
                      className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                      title="Copy command"
                    >
                      {copiedMap["step3-local"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Hosted CARF Cloud */}
            <div className="rounded-sm border border-border bg-card p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Cloud className="size-4 text-blue-500" />
                  <h2 className="text-sm font-semibold text-foreground">Hosted CARF Service (carf.indevs.in)</h2>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20">Production Cloud</Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your real GitHub repositories to the hosted CARF platform at <strong className="text-foreground">carf.indevs.in</strong>. GitHub App webhooks deliver commit push events directly for continuous AST analysis.
              </p>

              <div className="space-y-3 pt-1 text-xs">
                <div>
                  <span className="font-semibold text-foreground">Step 1: Install CARF GitHub App</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Navigate to the GitHub Integration tab and grant repository read/write access:
                  </p>
                  <div className="pt-1.5 flex items-center gap-2">
                    <Button render={<Link href="/dashboard/installations" />} size="sm" variant="outline" className="text-xs gap-1.5">
                      <span>Open GitHub Integration</span>
                      <ArrowRight className="size-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-foreground">Step 2: Commit .carf.yml Configuration</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Use the 1-Click Protection Wizard or commit <code className="font-mono text-foreground">.carf.yml</code> directly to your repository root:
                  </p>
                  <div className="relative mt-1">
                    <pre className="rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
                      {`version: "1.0"\nmode: augment\nthresholds:\n  base_tolerance_pct: 0.5\n  max_tolerance_pct: 3.5\n  observation_window_seconds: 180`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(`version: "1.0"\nmode: augment\nthresholds:\n  base_tolerance_pct: 0.5\n  max_tolerance_pct: 3.5\n  observation_window_seconds: 180`, "step2-cloud")}
                      className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                      title="Copy config"
                    >
                      {copiedMap["step2-cloud"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-foreground">Step 3: Push a commit & inspect Live Status</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Whenever you push a commit, CARF scores its AST churn and updates your Live Rollout Status:
                  </p>
                  <div className="relative mt-1">
                    <pre className="rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
                      {`curl -H "x-api-key: ${effectiveApiKey}" \\
  "https://carf.indevs.in/api/status/${selectedInstallationId}"`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(`curl -H "x-api-key: ${effectiveApiKey}" "https://carf.indevs.in/api/status/${selectedInstallationId}"`, "step3-cloud")}
                      className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                      title="Copy command"
                    >
                      {copiedMap["step3-cloud"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Serverless Project Testing */}
      {activeTab === "serverless" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-sm border border-border bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-amber-500" />
                <h2 className="text-base font-semibold text-foreground">
                  Testing CARF on Serverless Projects (AWS Lambda, Vercel, Cloudflare Workers, SST)
                </h2>
              </div>
              <Badge variant="secondary" className="font-mono text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20">
                Augment Mode
              </Badge>
            </div>

            <div className="rounded-sm border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-foreground space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Why Serverless Uses CARF Augment Mode</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Serverless functions (AWS Lambda, Vercel Functions, Cloudflare Workers) do not maintain persistent OS processes or PM2 daemons. Therefore, CARF operates in <strong>Augment Mode</strong>. Instead of executing local shell commands on a server, CARF exposes an API endpoint (<code className="font-mono text-foreground">GET /v1/threshold?commit=$SHA</code>) that your CI/CD deployment pipeline (GitHub Actions, GitLab CI) queries to dynamically calibrate progressive canary traffic shifting and trigger rollbacks.
              </p>
            </div>

            {/* Architecture Diagram */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Serverless Canary Deployment Workflow
              </span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded-sm border border-border bg-muted/30 p-3 space-y-1">
                  <div className="font-semibold text-foreground">1. Push Commit</div>
                  <p className="text-[11px] text-muted-foreground">GitHub App webhook delivers commit diff to CARF.</p>
                </div>
                <div className="rounded-sm border border-border bg-muted/30 p-3 space-y-1">
                  <div className="font-semibold text-foreground">2. Calculate Threshold</div>
                  <p className="text-[11px] text-muted-foreground">CARF Tree-sitter classifies AST complexity and yields dynamic tolerance.</p>
                </div>
                <div className="rounded-sm border border-border bg-muted/30 p-3 space-y-1">
                  <div className="font-semibold text-foreground">3. Canary Shift</div>
                  <p className="text-[11px] text-muted-foreground">Deployer routes 10% traffic to Lambda Alias or Vercel Preview.</p>
                </div>
                <div className="rounded-sm border border-border bg-muted/30 p-3 space-y-1">
                  <div className="font-semibold text-foreground">4. Dynamic Rollback</div>
                  <p className="text-[11px] text-muted-foreground">If canary error rate &gt; CARF threshold during window, instantly revert.</p>
                </div>
              </div>
            </div>

            {/* Recommended .carf.yml */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-foreground">
                1. Configuration: <code className="font-mono text-xs">.carf.yml</code>
              </span>
              <div className="relative">
                <pre className="rounded-sm bg-muted/60 p-4 font-mono text-[11px] overflow-x-auto text-foreground">
{`# Serverless progressive delivery configuration
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5        # 0.5% base error rate tolerance for low-risk changes
  max_tolerance_pct: 4.0         # Allow up to 4.0% tolerance for non-critical refactors
  observation_window_seconds: 180 # 3-minute canary soak period

rules:
  - name: serverless-handlers
    pattern: "src/handlers/**/*.{ts,js}"
    weight: 1.5
  - name: infrastructure-as-code
    pattern: "**/{serverless,sst,template}.{yml,yaml,json,ts}"
    weight: 2.0`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`version: "1.0"\nmode: augment\nthresholds:\n  base_tolerance_pct: 0.5\n  max_tolerance_pct: 4.0\n  observation_window_seconds: 180\nrules:\n  - name: serverless-handlers\n    pattern: "src/handlers/**/*.{ts,js}"\n    weight: 1.5\n  - name: infrastructure-as-code\n    pattern: "**/{serverless,sst,template}.{yml,yaml,json,ts}"\n    weight: 2.0`, "serverless-carf")}
                  className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                  title="Copy .carf.yml"
                >
                  {copiedMap["serverless-carf"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>

            {/* Complete GitHub Actions Workflow */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-foreground">
                2. Serverless CI/CD Pipeline: <code className="font-mono text-xs">.github/workflows/deploy.yml</code>
              </span>
              <p className="text-[11px] text-muted-foreground">
                This workflow deploys your serverless function, fetches the CARF dynamic threshold, evaluates canary metrics, and reverts traffic automatically if an anomaly occurs:
              </p>
              <div className="relative">
                <pre className="rounded-sm bg-muted/60 p-4 font-mono text-[11px] overflow-x-auto text-foreground leading-relaxed">
{`name: Serverless Deploy & Dynamic Canary Verification
on:
  push:
    branches: [main]

jobs:
  canary-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 1. Fetch CARF dynamic risk threshold
      - name: Fetch CARF dynamic threshold
        id: carf
        uses: ./.github/actions/carf-threshold
        with:
          api-url: https://carf.indevs.in
          commit: \${{ github.sha }}
          fail-on-missing: false

      - name: Inspect Computed Risk Budget
        run: |
          echo "Computed Dynamic Threshold: \${{ steps.carf.outputs.final-threshold || '0.01' }}"
          echo "Observation Window: \${{ steps.carf.outputs.final-window || '180' }}s"
          echo "Active AST Types: \${{ steps.carf.outputs.active-types }}"

      # 2. Deploy Serverless Function (e.g. AWS Lambda / Vercel / SST)
      - name: Deploy Serverless Canary
        run: |
          echo "Deploying new version \${{ github.sha }} to canary alias (10% traffic)..."
          # Example for AWS Lambda:
          # aws lambda update-alias --function-name my-api --name live \\
          #   --routing-config '{"AdditionalVersionWeights": {"2": 0.1}}'
          # Example for Vercel:
          # vercel deploy --prebuilt

      # 3. Canary Verification Window (Soak Period)
      - name: Observe Canary Error Rate
        run: |
          WINDOW=\${{ steps.carf.outputs.final-window || '180' }}
          THRESHOLD=\${{ steps.carf.outputs.final-threshold || '0.01' }}
          echo "Monitoring telemetry for \${WINDOW}s against tolerance \${THRESHOLD}..."
          # Fetch CloudWatch / Datadog / Sentry 5xx error rate:
          # ERROR_RATE=$(curl -s "https://telemetry.internal/error-rate")
          # if (( $(echo "$ERROR_RATE > $THRESHOLD" | bc -l) )); then
          #   echo "CRITICAL: Error rate $ERROR_RATE exceeded dynamic threshold $THRESHOLD"
          #   exit 1
          # fi

      # 4. Instant Rollback if Canary Fails
      - name: Automated Serverless Rollback on Breach
        if: failure()
        run: |
          echo "🚨 Rollback triggered! Reverting traffic to previous stable version..."
          # AWS Lambda rollback:
          # aws lambda update-alias --function-name my-api --name live --routing-config '{"AdditionalVersionWeights": {}}'
          # Vercel instant rollback:
          # vercel rollback`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`name: Serverless Deploy & Dynamic Canary Verification\non:\n  push:\n    branches: [main]\n\njobs:\n  canary-deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Fetch CARF dynamic threshold\n        id: carf\n        uses: ./.github/actions/carf-threshold\n        with:\n          api-url: https://carf.indevs.in\n          commit: \${{ github.sha }}\n          fail-on-missing: false\n      - name: Inspect Computed Risk Budget\n        run: |\n          echo "Computed Dynamic Threshold: \${{ steps.carf.outputs.final-threshold || '0.01' }}"\n          echo "Observation Window: \${{ steps.carf.outputs.final-window || '180' }}s"\n      - name: Deploy Serverless Canary\n        run: |\n          echo "Deploying canary..."\n      - name: Automated Serverless Rollback on Breach\n        if: failure()\n        run: |\n          echo "Reverting serverless traffic..."`, "serverless-workflow")}
                  className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                  title="Copy workflow"
                >
                  {copiedMap["serverless-workflow"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: PM2 Process Manager Testing */}
      {activeTab === "pm2" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-sm border border-border bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-indigo-500" />
                <h2 className="text-base font-semibold text-foreground">
                  Testing CARF on PM2 Projects (Node.js VPS, EC2, Bare-Metal)
                </h2>
              </div>
              <Badge variant="secondary" className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                Standalone Mode
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              In <strong>Standalone Mode</strong> with PM2, CARF actively monitors your live Node.js process group. It maintains Capistrano-style immutable release directories (<code className="font-mono text-foreground">/var/www/releases/&lt;sha&gt;</code>) linked via a symlink (<code className="font-mono text-foreground">/var/www/current</code>). If PM2 reports an unhealthy state or crashes, CARF atomically points the symlink back to the previous stable release and triggers a zero-downtime <code className="font-mono text-foreground">pm2 reload</code>.
            </p>

            {/* Architecture Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
              <div className="rounded-sm border border-border bg-muted/20 p-4 space-y-2">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <GitBranch className="size-3.5 text-indigo-500" />
                  Release Directory Architecture
                </span>
                <pre className="font-mono text-[11px] text-foreground bg-background p-3 rounded-sm border border-border">
{`/var/www/
├── releases/
│   ├── a1b2c3d/  # Previous Stable Release
│   └── e4f5g6h/  # New Canary Release
└── current -> /var/www/releases/e4f5g6h`}
                </pre>
                <p className="text-[11px] text-muted-foreground">
                  PM2 runs through the symlink: <code className="font-mono">pm2 start /var/www/current/dist/index.js --name &quot;my-app&quot;</code>.
                </p>
              </div>

              <div className="rounded-sm border border-border bg-muted/20 p-4 space-y-2">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <RotateCcw className="size-3.5 text-indigo-500" />
                  Autonomous Zero-Downtime Rollback
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  When CARF detects <code className="font-mono">errorRate &gt; finalThreshold</code> via <code className="font-mono">pm2 jlist</code>:
                </p>
                <div className="space-y-1.5 font-mono text-[11px] text-foreground bg-background p-3 rounded-sm border border-border">
                  <div>1. ln -sfn /var/www/releases/a1b2c3d /var/www/current</div>
                  <div>2. pm2 reload my-app</div>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Cluster processes reload sequentially with zero user-facing downtime.
                </p>
              </div>
            </div>

            {/* .carf.yml for PM2 */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-foreground">
                1. PM2 Configuration: <code className="font-mono text-xs">.carf.yml</code>
              </span>
              <div className="relative">
                <pre className="rounded-sm bg-muted/60 p-4 font-mono text-[11px] overflow-x-auto text-foreground">
{`version: "1.0"
mode: standalone
adapter:
  kind: pm2
  target: my-app # Must match the 'name' in your pm2 process list or ecosystem.config.js
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 2.5
  observation_window_seconds: 120`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`version: "1.0"\nmode: standalone\nadapter:\n  kind: pm2\n  target: my-app\nthresholds:\n  base_tolerance_pct: 0.5\n  max_tolerance_pct: 2.5\n  observation_window_seconds: 120`, "pm2-carf")}
                  className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                  title="Copy .carf.yml"
                >
                  {copiedMap["pm2-carf"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>

            {/* Step-by-Step Hands-On PM2 Failure Simulation */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Play className="size-3.5 text-primary" />
                <span>2. Hands-On PM2 Rollback Simulation Recipe (Try it on your VM or Local Machine)</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-foreground">Step A: Setup release directories & start app</span>
                  <div className="relative mt-1">
                    <pre className="rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
{`# Create initial release
mkdir -p /var/www/releases/sha-1 /var/www/releases/sha-2
echo 'console.log("v1 stable running"); setInterval(() => {}, 1000);' > /var/www/releases/sha-1/app.js
ln -sfn /var/www/releases/sha-1 /var/www/current

# Start PM2
pm2 start /var/www/current/app.js --name "my-app" -i 2`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(`mkdir -p /var/www/releases/sha-1 /var/www/releases/sha-2\necho 'console.log("v1 stable running"); setInterval(() => {}, 1000);' > /var/www/releases/sha-1/app.js\nln -sfn /var/www/releases/sha-1 /var/www/current\npm2 start /var/www/current/app.js --name "my-app" -i 2`, "pm2-step-a")}
                      className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                      title="Copy script"
                    >
                      {copiedMap["pm2-step-a"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-foreground">Step B: Deploy faulty release (sha-2)</span>
                  <div className="relative mt-1">
                    <pre className="rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
{`# Simulate buggy release that throws uncaught exception
echo 'console.log("v2 crashing"); process.exit(1);' > /var/www/releases/sha-2/app.js
ln -sfn /var/www/releases/sha-2 /var/www/current
pm2 reload my-app`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(`echo 'console.log("v2 crashing"); process.exit(1);' > /var/www/releases/sha-2/app.js\nln -sfn /var/www/releases/sha-2 /var/www/current\npm2 reload my-app`, "pm2-step-b")}
                      className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                      title="Copy script"
                    >
                      {copiedMap["pm2-step-b"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-foreground">Step C: Watch CARF detect failure & execute rollback</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Run CARF&apos;s standalone watchdog loop or execute the adapter directly:
                  </p>
                  <div className="relative mt-1">
                    <pre className="rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
{`# CARF checks health:
# pm2 jlist -> status != "online" -> errorRate: 1.0 > threshold: 0.005
# CARF triggers rollback:
# ln -sfn /var/www/releases/sha-1 /var/www/current && pm2 reload my-app
pm2 status my-app
ls -la /var/www/current`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(`pm2 status my-app\nls -la /var/www/current`, "pm2-step-c")}
                      className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
                      title="Copy script"
                    >
                      {copiedMap["pm2-step-c"] ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Containers & Orchestrators */}
      {activeTab === "containers" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Docker Compose */}
            <div className="rounded-sm border border-border bg-card p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Boxes className="size-4 text-blue-500" />
                  <h2 className="text-sm font-semibold text-foreground">Docker Compose Projects</h2>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">Standalone</Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                CARF drives zero-downtime container rollbacks by parameterizing your service image tag with <code className="font-mono text-foreground">IMAGE_TAG</code>.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-foreground">1. docker-compose.yml Spec</span>
                  <pre className="mt-1 rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
{`services:
  web:
    image: my-registry/app:\${IMAGE_TAG:-latest}
    restart: unless-stopped
    ports: ["3000:3000"]`}
                  </pre>
                </div>

                <div>
                  <span className="font-semibold text-foreground">2. .carf.yml Configuration</span>
                  <pre className="mt-1 rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
{`version: "1.0"
mode: standalone
adapter:
  kind: dockerCompose
  target: web`}
                  </pre>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  On health breach, CARF executes: <code className="font-mono text-foreground">IMAGE_TAG=&lt;baseSha&gt; docker compose up -d web</code>.
                </p>
              </div>
            </div>

            {/* Kubernetes & Argo Rollouts */}
            <div className="rounded-sm border border-border bg-card p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Cloud className="size-4 text-emerald-500" />
                  <h2 className="text-sm font-semibold text-foreground">Kubernetes & Argo Rollouts</h2>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">Augment / GitOps</Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                CARF plugs directly into Argo Rollouts via an <code className="font-mono text-foreground">AnalysisTemplate</code> to dynamically compute failure tolerance instead of using static 1% canary limits.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-foreground">Argo Rollouts AnalysisTemplate</span>
                  <pre className="mt-1 rounded-sm bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto text-foreground">
{`apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: carf-dynamic-tolerance
spec:
  metrics:
  - name: carf-threshold
    web:
      url: "https://carf.indevs.in/v1/threshold?commit={{args.commit}}"
      jsonPath: "{$.finalThreshold}"`}
                  </pre>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Argo Rollouts adjusts its rollback threshold dynamically based on commit risk calibration.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Summary Card */}
      <div className="rounded-sm border border-border bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-foreground">
          <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
          <span>Need to tune specific sensitivity weights for database migrations or AST branches?</span>
        </div>
        <Link
          href={`/dashboard/config/${selectedInstallationId}/rules`}
          className="font-medium text-primary hover:underline underline-offset-4 shrink-0"
        >
          Customize Threshold Rules →
        </Link>
      </div>
    </div>
  );
}
