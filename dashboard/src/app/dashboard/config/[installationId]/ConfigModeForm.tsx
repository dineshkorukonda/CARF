"use client";

import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "../../../../components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Button } from "../../../../components/ui/button";
import { LIVE_ADAPTER_KINDS, type AdapterKind } from "../../../../lib/carfConfigSchema";
import { Check, ChevronDown, ChevronUp, Copy, Info, Terminal, Container, Box, Server, GitBranch, Loader2, Globe, Sparkles } from "lucide-react";

interface ConfigModeFormProps {
  installationId: string;
  owner: string;
  repo: string;
  defaultMode: "standalone" | "augment";
  defaultAdapterKind: AdapterKind;
  defaultAdapterTarget: string;
}

interface AdapterMetadata {
  label: string;
  placeholder: string;
  description: string;
  serverGuide: {
    prerequisites: string;
    layout?: string;
    command: string;
    rollbackAction: string;
    sampleYml: (target: string) => string;
  };
}

const ADAPTER_DETAILS: Record<AdapterKind, AdapterMetadata> = {
  pm2: {
    label: "PM2 Process Name",
    placeholder: "e.g. api-server",
    description: "CARF repoints /var/www/current to /var/www/releases/<baseSha> and executes 'pm2 reload <target>' for zero-downtime rollback.",
    serverGuide: {
      prerequisites: "Node.js / Python / Ruby app running on a VPS or bare-metal server with PM2 installed.",
      layout: `/var/www/my-app/
├── current -> releases/<currentSha>   # Active release symlink
└── releases/
    ├── <previousSha>/
    └── <currentSha>/`,
      command: "pm2 start /var/www/my-app/current/dist/index.js --name \"<target>\"",
      rollbackAction: "ln -sfn releases/<baseSha> current && pm2 reload <target>",
      sampleYml: (target) => `mode: standalone
adapter:
  kind: pm2
  target: "${target || "api-server"}"

threshold:
  types:
    code:
      baseThreshold: 0.05
      baseWindow: 900
    config:
      baseThreshold: 0.025
      baseWindow: 300
    data:
      baseThreshold: 0.01
      baseWindow: 600`,
    },
  },
  dockerCompose: {
    label: "Docker Compose Service Name",
    placeholder: "e.g. web",
    description: "CARF redeploys via 'IMAGE_TAG=<baseSha> docker compose up -d <target>'. Ensure your compose file uses ${IMAGE_TAG}.",
    serverGuide: {
      prerequisites: "Docker Engine and Compose v2 running on an EC2, Droplet, or on-prem Linux VM.",
      layout: `services:
  ${"<target>"}:
    image: my-registry.com/app:\${IMAGE_TAG:-latest}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3`,
      command: "IMAGE_TAG=latest docker compose up -d <target>",
      rollbackAction: "IMAGE_TAG=<baseSha> docker compose -f docker-compose.yml up -d <target>",
      sampleYml: (target) => `mode: standalone
adapter:
  kind: dockerCompose
  target: "${target || "web"}"`,
    },
  },
  dockerSwarm: {
    label: "Docker Swarm Service Name",
    placeholder: "e.g. prod_web",
    description: "CARF executes 'docker service update --rollback <target>'. Swarm tracks previous task specs natively.",
    serverGuide: {
      prerequisites: "Docker Swarm cluster initialized with active manager node.",
      command: "docker service create --name <target> --rollback-config \"order=start-first\" my-app:latest",
      rollbackAction: "docker service update --rollback <target>",
      sampleYml: (target) => `mode: standalone
adapter:
  kind: dockerSwarm
  target: "${target || "prod_web"}"`,
    },
  },
  kubernetes: {
    label: "Kubernetes Deployment Name",
    placeholder: "e.g. api-deployment",
    description: "CARF executes 'kubectl rollout undo deployment/<target>' when the dynamic error threshold is breached.",
    serverGuide: {
      prerequisites: "Kubernetes cluster with kubectl configured and deployment resource created.",
      command: "kubectl apply -f deployment.yaml",
      rollbackAction: "kubectl rollout undo deployment/<target>",
      sampleYml: (target) => `mode: standalone
adapter:
  kind: kubernetes
  target: "${target || "api-deployment"}"`,
    },
  },
  gitops: {
    label: "Argo CD Application Name",
    placeholder: "e.g. production-app",
    description: "CARF rolls back the specified Argo CD application to the base revision via the Argo CD API.",
    serverGuide: {
      prerequisites: "Argo CD GitOps repository tracking deployment manifests.",
      command: "argocd app sync <target>",
      rollbackAction: "Automated Git revert commit dispatched to repo",
      sampleYml: (target) => `mode: standalone
adapter:
  kind: gitops
  target: "${target || "production-app"}"`,
    },
  },
};

export function ConfigModeForm({
  installationId,
  owner,
  repo,
  defaultMode,
  defaultAdapterKind,
  defaultAdapterTarget,
}: ConfigModeFormProps) {
  const [mode, setMode] = useState<"standalone" | "augment">(defaultMode);
  const [adapterKind, setAdapterKind] = useState<AdapterKind>(defaultAdapterKind);
  const [adapterTarget, setAdapterTarget] = useState(defaultAdapterTarget);
  const [showGuide, setShowGuide] = useState(true);
  const [copiedYml, setCopiedYml] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentAdapter = ADAPTER_DETAILS[adapterKind] ?? ADAPTER_DETAILS.kubernetes;
  const guide = currentAdapter.serverGuide;

  const handleCopyYml = async () => {
    const text = guide.sampleYml(adapterTarget);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedYml(true);
      setTimeout(() => setCopiedYml(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedYml(true);
      setTimeout(() => setCopiedYml(false), 2000);
    }
  };

  return (
    <form
      action="/api/config/save"
      method="POST"
      onSubmit={() => setIsSaving(true)}
      className="mt-4 flex flex-col gap-6"
    >
      <input type="hidden" name="installationId" value={installationId} />
      <input type="hidden" name="owner" value={owner} />
      <input type="hidden" name="repo" value={repo} />

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1 text-sm font-medium">Operating Mode</legend>
        <RadioGroup
          name="mode"
          value={mode}
          onValueChange={(val) => setMode(val as "standalone" | "augment")}
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          <Label className="flex items-center gap-2 font-normal cursor-pointer">
            <RadioGroupItem value="augment" />
            <span>Augment Mode</span>
          </Label>
          <Label className="flex items-center gap-2 font-normal cursor-pointer">
            <RadioGroupItem value="standalone" />
            <span>Standalone Mode</span>
          </Label>
        </RadioGroup>
      </fieldset>

      {mode === "augment" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 text-xs text-blue-900 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-blue-900">
              <Info className="size-4 text-blue-600 shrink-0" />
              <span>Augment / Advisory Mode Active</span>
            </div>
            <p className="text-blue-800 leading-relaxed">
              CARF dynamically scores each commit diff and computes custom risk thresholds and observation windows.
              Your deployment pipeline or PR check queries <code className="rounded bg-white px-1.5 py-0.5 font-mono text-blue-950 border border-blue-200">GET /v1/threshold?commit=$SHA</code> to monitor releases.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
            <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="size-4 text-blue-600" />
              <span>Quick Cloud Presets (Vercel · Render · PM2)</span>
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                  <Globe className="size-3.5 text-blue-600" />
                  <span>Vercel / Next.js Preset</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Runs as PR check badge and canary risk monitor. Query threshold in GitHub Actions.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                  <Server className="size-3.5 text-indigo-600" />
                  <span>Render.com Preset</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Trigger Deploy Hook and soak health endpoint for the calculated window duration.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-4 rounded-sm border border-border p-4 bg-card">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Standalone Rollback Engine
          </legend>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Deployment Engine / Adapter Type</Label>
            <Select
              name="adapterKind"
              value={adapterKind}
              onValueChange={(val) => setAdapterKind(val as AdapterKind)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIVE_ADAPTER_KINDS.map((kind: AdapterKind) => (
                  <SelectItem key={kind} value={kind}>
                    {kind === "pm2" ? "PM2 Process Manager (Node / VPS)" :
                     kind === "dockerCompose" ? "Docker Compose (Single VM)" :
                     kind === "dockerSwarm" ? "Docker Swarm (Cluster)" :
                     kind === "kubernetes" ? "Kubernetes (kubectl)" :
                     kind === "gitops" ? "GitOps (Argo CD)" : kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">{currentAdapter.label}</Label>
            <Input
              type="text"
              name="adapterTarget"
              placeholder={currentAdapter.placeholder}
              value={adapterTarget}
              onChange={(e) => setAdapterTarget(e.target.value)}
              required={mode === "standalone"}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {currentAdapter.description}
            </p>
          </div>

          {/* Interactive Setup & Architecture Walkthrough Drawer */}
          <div className="rounded-sm border border-border bg-muted/20 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between p-3 bg-muted/40 font-medium hover:bg-muted/60 transition-colors text-foreground"
            >
              <div className="flex items-center gap-2">
                {adapterKind === "pm2" ? <Terminal className="size-3.5 text-primary shrink-0" /> :
                 adapterKind === "dockerCompose" ? <Container className="size-3.5 text-primary shrink-0" /> :
                 adapterKind === "dockerSwarm" ? <Box className="size-3.5 text-primary shrink-0" /> :
                 adapterKind === "kubernetes" ? <Server className="size-3.5 text-primary shrink-0" /> :
                 <GitBranch className="size-3.5 text-primary shrink-0" />}
                <span>Setup Guide for {currentAdapter.label.split(" ")[0]}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                <span>{showGuide ? "Hide" : "Show"} walkthrough</span>
                {showGuide ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </div>
            </button>

            {showGuide && (
              <div className="p-4 space-y-4 border-t border-border">
                <div>
                  <span className="font-semibold text-foreground">Prerequisites: </span>
                  <span className="text-muted-foreground">{guide.prerequisites}</span>
                </div>

                {guide.layout && (
                  <div className="space-y-1">
                    <span className="font-semibold text-foreground">
                      {adapterKind === "pm2" ? "Server Release Layout:" : "docker-compose.yml Spec:"}
                    </span>
                    <pre className="p-2.5 rounded bg-muted font-mono text-[11px] overflow-x-auto text-foreground leading-relaxed">
                      {guide.layout.replace(/<target>/g, adapterTarget || "my-service")}
                    </pre>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Process Start Command:</span>
                  <pre className="p-2 rounded bg-muted font-mono text-[11px] overflow-x-auto text-foreground">
                    {guide.command.replace(/<target>/g, adapterTarget || "my-service")}
                  </pre>
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Automated Rollback on Breach:</span>
                  <pre className="p-2 rounded bg-muted font-mono text-[11px] overflow-x-auto text-foreground">
                    {guide.rollbackAction.replace(/<target>/g, adapterTarget || "my-service")}
                  </pre>
                </div>

                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Required .carf.yml:</span>
                    <button
                      type="button"
                      onClick={handleCopyYml}
                      className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 font-mono text-[11px] border border-border text-foreground hover:bg-muted transition-colors"
                    >
                      {copiedYml ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      <span>{copiedYml ? "Copied" : "Copy .carf.yml"}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-muted font-mono text-[11px] overflow-x-auto text-foreground leading-relaxed">
                    {guide.sampleYml(adapterTarget)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </fieldset>
      )}

      {isSaving && (
        <div className="flex items-center gap-2 rounded-sm border border-primary/30 bg-primary/10 p-3 text-xs text-primary animate-pulse">
          <Loader2 className="size-3.5 animate-spin shrink-0" />
          <span>Committing updated .carf.yml to {owner}/{repo} via GitHub App...</span>
        </div>
      )}

      <Button type="submit" disabled={isSaving} className="self-start min-w-36">
        {isSaving ? (
          <>
            <Loader2 className="size-4 animate-spin mr-2" />
            <span>Saving to GitHub...</span>
          </>
        ) : (
          "Save Configuration"
        )}
      </Button>
    </form>
  );
}
