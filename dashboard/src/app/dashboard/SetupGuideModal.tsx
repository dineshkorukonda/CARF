"use client";

import { useState } from "react";
import {
  X,
  Check,
  Copy,
  Terminal,
  Server,
  Layers,
  ShieldCheck,
  Code2,
  FileCode2,
  BookOpen,
} from "lucide-react";

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  installationId?: string;
  repoName?: string;
}

type StackPreset = "pm2" | "k8s" | "render";

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
    badge: "Active / Verified",
    icon: Terminal,
    description:
      "For Node.js servers running PM2 with release directories or git deployments.",
    modeExplanation:
      "CARF dynamically tunes error tolerance for each commit. When deploying with PM2, CARF monitors pm2 process status and health probes during the soak window and runs zero-downtime pm2 reload to the previous release if errors exceed threshold.",
    carfYml: `# .carf.yml (Place in repository root)
version: "1.0"
mode: standalone
adapter:
  kind: pm2
rules:
  - name: sensitive-routes
    pattern: "src/{routes,controllers,auth}/**/*.{ts,js}"
    weight: 1.8
`,
    deploySnippetTitle: "ecosystem.config.cjs & symlink deploy pattern",
    deploySnippet: `// 1. Release directories structure:
// /var/www/my-app/
// ├── current -> releases/<currentSha>
// └── releases/
//     ├── <previousSha>/
//     └── <currentSha>/

// 2. Start PM2 cluster:
pm2 start /var/www/my-app/current/dist/index.js --name "api-server" -i max

// 3. CARF automated rollback on threshold breach:
// ln -sfn /var/www/my-app/releases/<baseSha> /var/www/my-app/current
// pm2 reload api-server
`,
    verificationSteps: [
      "Set up PM2 cluster mode with release symlinks on your server.",
      "Add `.carf.yml` with `mode: standalone` and `adapter.kind: pm2`.",
      "Push a commit and observe CARF watchdog monitor PM2 process health.",
      "Simulate an error spike to verify automated reload back to previous release.",
    ],
  },
  k8s: {
    title: "Kubernetes & Argo Rollouts",
    badge: "Adapter Preview / In-Development",
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
      "Add AnalysisTemplate to your Argo Rollouts canary spec.",
      "Push `.carf.yml` with `mode: augment`.",
      "Argo Rollouts will automatically query CARF to evaluate promotion thresholds.",
    ],
  },
  render: {
    title: "Render (Web Services & Deploy Hooks)",
    badge: "Augment / Webhook Mode",
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
    deploySnippetTitle: "ecosystem.config.cjs & symlink deploy pattern",
    deploySnippet: `// 1. Release directories structure:
// /var/www/my-app/
// ├── current -> releases/<currentSha>
// └── releases/
//     ├── <previousSha>/
//     └── <currentSha>/

# Fetch CARF threshold
RES=$(curl -s "https://carf.indevs.in/v1/threshold?commit=$(git rev-parse HEAD)")
WINDOW=$(echo $RES | jq -r '.finalWindow // 240')

echo "Waiting \${WINDOW}s to soak Render service..."
sleep 15
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://my-app.onrender.com/healthz)
if [ "$HTTP_STATUS" -ne 200 ]; then
  echo "🚨 Render healthcheck failed ($HTTP_STATUS). Check logs!"
  exit 1
fi
echo "✅ Render service healthy."
`,
    verificationSteps: [
      "Commit `.carf.yml` into your repository.",
      "Configure your Render Deploy Hook or CI action.",
      "Observe the Live Status tab on CARF dashboard as commits are pushed.",
    ],
  },
};

export function SetupGuideModal({
  isOpen,
  onClose,
  repoName = "my-repository",
}: SetupGuideModalProps) {
  const [selectedStack, setSelectedStack] = useState<StackPreset>("pm2");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPreset = PRESETS[selectedStack];
  const PresetIcon = currentPreset.icon;

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Setup & Integration Guide
              </h2>
              <p className="text-xs text-slate-500">
                Deploy dynamic canary rollback thresholds to {repoName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Stack Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-2 gap-1.5 overflow-x-auto">
          {(
            [
              { id: "pm2", label: "PM2 (Node.js/VPS)", icon: Terminal },
              { id: "k8s", label: "Kubernetes & Argo (Preview)", icon: Layers },
              { id: "render", label: "Render / Deploy Hooks", icon: Server },
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
                <PresetIcon className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">{currentPreset.title}</h3>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                    {currentPreset.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{currentPreset.description}</p>
              </div>
            </div>
          </div>

          {/* Mode explanation */}
          <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-3.5 text-xs text-blue-900 leading-relaxed">
            <span className="font-semibold">How CARF works here: </span>
            {currentPreset.modeExplanation}
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
                  onClick={() => handleCopy(currentPreset.carfYml, "yml")}
                  className="flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-xs"
                >
                  {copiedSection === "yml" ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{copiedSection === "yml" ? "Copied" : "Copy YAML"}</span>
                </button>
              </div>
              <pre className="flex-1 p-3.5 text-[11px] font-mono text-slate-800 bg-slate-900 text-slate-100 overflow-x-auto">
                <code>{currentPreset.carfYml}</code>
              </pre>
            </div>

            {/* Deploy Snippet */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Code2 className="size-4 text-indigo-600" />
                  <span>Step 2: {currentPreset.deploySnippetTitle}</span>
                </div>
                <button
                  onClick={() => handleCopy(currentPreset.deploySnippet, "deploy")}
                  className="flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-xs"
                >
                  {copiedSection === "deploy" ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{copiedSection === "deploy" ? "Copied" : "Copy Code"}</span>
                </button>
              </div>
              <pre className="flex-1 p-3.5 text-[11px] font-mono text-slate-100 bg-slate-900 overflow-x-auto">
                <code>{currentPreset.deploySnippet}</code>
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
              {currentPreset.verificationSteps.map((step, idx) => (
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
            Need custom sensitivity rules? Open <strong>Thresholds</strong> from the project page.
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
