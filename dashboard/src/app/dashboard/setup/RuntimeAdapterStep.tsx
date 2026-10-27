"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Shield, Server, Box, Layers, Cpu, RefreshCw, Activity } from "lucide-react";
import type { InstallationRepo } from "../../../adapters/github/reposClient";
import type { RuntimeAdapter } from "../../../lib/capabilities";
import { CARF_TERMS, SETUP_EXPLANATIONS } from "../../../lib/terminology";
import { Input } from "../../../components/ui/input";

interface RuntimeAdapterStepProps {
  installationId: string;
  selectedRepo: InstallationRepo | null;
  selectedAdapter: RuntimeAdapter;
  onSelectAdapter: (adapter: RuntimeAdapter) => void;
  pm2Config: {
    targetName: string;
    cwd: string;
    healthUrl: string;
    buildCommand: string;
    layout: "releases" | "git";
  };
  onChangePm2Config: (config: {
    targetName: string;
    cwd: string;
    healthUrl: string;
    buildCommand: string;
    layout: "releases" | "git";
  }) => void;
  dockerConfig: {
    containerName: string;
    composeFile: string;
    healthUrl: string;
  };
  onChangeDockerConfig: (config: {
    containerName: string;
    composeFile: string;
    healthUrl: string;
  }) => void;
  onBack: () => void;
  onContinue: () => void;
}

interface AdapterOption {
  id: RuntimeAdapter;
  name: string;
  tag: string;
  tagColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  features: string[];
}

interface DiscoveredApp {
  name: string;
  status: string;
  restarts?: number;
  uptime?: number;
  cwd?: string;
  pid?: number;
}

interface ProcessResponse extends Partial<DiscoveredApp> {
  pm_id?: number;
  restart_time?: number;
  pm2_env?: {
    status?: string;
    restart_time?: number;
    pm_uptime?: number;
    pm_cwd?: string;
  };
}

const ADAPTER_OPTIONS: AdapterOption[] = [
  {
    id: "none",
    name: "Policy Only (No Direct Runtime)",
    tag: "Active · Recommended",
    tagColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: Shield,
    description: "External CD orchestrator manages deployments. CARF operates as a pure policy engine with ZERO server footprint.",
    features: [
      "Zero agent installation required on your hosts",
      "Dynamic risk vectors and soak window policies",
      "CD pipeline executes promotion or rollback",
    ],
  },
  {
    id: "pm2",
    name: "PM2 Process Manager",
    tag: "Active · Automated Rollback",
    tagColor: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    icon: Server,
    description: "Active health monitoring and automated instant rollback on target servers running PM2.",
    features: [
      "Direct local PM2 adapter (zero host agent required)",
      "Continuous health URL probing during observation window",
      "Automated symlink / git rollback on threshold breach",
    ],
  },
  {
    id: "docker",
    name: "Docker / Docker Compose",
    tag: "Active · Automated Rollback",
    tagColor: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    icon: Box,
    description: "Direct Docker daemon / Docker Compose adapter with container health monitoring and automated rollback.",
    features: [
      "Direct Docker daemon / Docker Compose runtime",
      "Continuous health URL probing during observation window",
      "Automated rollback to previous image tag or compose state",
      "Zero host agent required",
    ],
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    tag: "Preview",
    tagColor: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: Layers,
    description: "In development. Direct pod and deployment rollback controller for cluster environments.",
    features: [
      "Policy-guided threshold evaluation currently active",
      "Live rollback adapter scheduled for next release",
      "No host agent required",
    ],
  },
  {
    id: "systemd",
    name: "systemd Services",
    tag: "Roadmap",
    tagColor: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    icon: Cpu,
    description: "In development. Linux service unit management and rollback.",
    features: [
      "Policy-guided threshold evaluation currently active",
      "Live rollback adapter scheduled for next release",
      "No host agent required",
    ],
  },
];

export function RuntimeAdapterStep({
  installationId,
  selectedRepo,
  selectedAdapter,
  onSelectAdapter,
  pm2Config,
  onChangePm2Config,
  dockerConfig,
  onChangeDockerConfig,
  onBack,
  onContinue,
}: RuntimeAdapterStepProps) {
  const [discoveredProcesses, setDiscoveredProcesses] = useState<DiscoveredApp[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [pm2Error, setPm2Error] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAdapter !== "pm2") return;
    let active = true;

    async function fetchPm2Processes() {
      setLoadingProcesses(true);
      setPm2Error(null);
      try {
        const res = await fetch(`/api/pm2/processes?installationId=${encodeURIComponent(installationId)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (active) {
          const apps: DiscoveredApp[] = (data.processes || []).map((p: ProcessResponse) => ({
            name: p.name || p.pm_id?.toString() || "unknown",
            status: p.pm2_env?.status || p.status || "unknown",
            restarts: p.pm2_env?.restart_time ?? p.restart_time,
            uptime: p.pm2_env?.pm_uptime ?? p.uptime,
            cwd: p.pm2_env?.pm_cwd ?? p.cwd,
            pid: p.pid,
          }));
          setDiscoveredProcesses(apps);
        }
      } catch (err: unknown) {
        if (active) {
          setPm2Error(
            err instanceof Error
              ? `Could not discover local PM2 processes: ${err.message}`
              : "Could not discover PM2 processes on host"
          );
        }
      } finally {
        if (active) setLoadingProcesses(false);
      }
    }

    fetchPm2Processes();

    return () => {
      active = false;
    };
  }, [selectedAdapter, installationId]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <span>Step 3</span>
          <span>•</span>
          <span>Layer 3: {CARF_TERMS.runtimeIntegration.label}</span>
        </div>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
          Choose {CARF_TERMS.runtimeIntegration.label}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {SETUP_EXPLANATIONS.runtimeIntegration}
        </p>
      </div>

      {/* Adapter Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ADAPTER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selectedAdapter === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => onSelectAdapter(opt.id)}
              className={`cursor-pointer rounded-xl border p-5 transition-all relative flex flex-col justify-between ${
                isSelected
                  ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary"
                  : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 text-primary">
                  <CheckCircle2 className="size-5" />
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${opt.tagColor}`}>
                    {opt.tag}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-base font-bold text-foreground">{opt.name}</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {opt.description}
                </p>

                <div className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                  {opt.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-primary font-bold mt-0.5">•</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAdapter(opt.id);
                  }}
                  className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "border border-border bg-muted/40 text-foreground hover:bg-muted"
                  }`}
                >
                  {isSelected ? `Selected: ${opt.name}` : `Select ${opt.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline PM2 Configuration when PM2 is selected */}
      {selectedAdapter === "pm2" && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.03] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="size-4 text-sky-500" />
              <h3 className="text-sm font-semibold text-foreground">PM2 Configuration &amp; {CARF_TERMS.deploymentTarget.label}</h3>
            </div>
            {loadingProcesses && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="size-3 animate-spin" />
                <span>Scanning PM2 processes...</span>
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Configure how {CARF_TERMS.core.label} interacts with the local PM2 runtime. Select from detected processes or specify target details manually.
          </p>
          {pm2Error && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {pm2Error} (You can still enter process details manually below)
            </p>
          )}

          {/* Detected Processes Picker */}
          {discoveredProcesses.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-foreground">
                <span>Detected PM2 Processes on Host:</span>
                <span className="text-[11px] text-muted-foreground">Click to select</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {discoveredProcesses.map((proc) => {
                  const isTarget = pm2Config.targetName === proc.name;
                  return (
                    <button
                      key={proc.name}
                      type="button"
                      onClick={() =>
                        onChangePm2Config({
                          ...pm2Config,
                          targetName: proc.name,
                          cwd: proc.cwd || pm2Config.cwd,
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium font-mono transition-colors ${
                        isTarget
                          ? "border border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold"
                          : "border border-border bg-muted/30 text-foreground hover:bg-muted"
                      }`}
                    >
                      <Activity className={`size-3 ${proc.status === "online" ? "text-emerald-500" : "text-amber-500"}`} />
                      <span>{proc.name}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">({proc.status})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-foreground">{CARF_TERMS.deploymentTarget.label} (Process Name)</label>
              <input
                type="text"
                value={pm2Config.targetName}
                onChange={(e) => onChangePm2Config({ ...pm2Config, targetName: e.target.value })}
                placeholder={selectedRepo?.name ?? "my-app"}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{SETUP_EXPLANATIONS.deploymentTarget}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Working Directory (cwd)</label>
              <input
                type="text"
                value={pm2Config.cwd}
                onChange={(e) => onChangePm2Config({ ...pm2Config, cwd: e.target.value })}
                placeholder={`/opt/${selectedRepo?.name ?? "app"}`}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Absolute path to application root</p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">{CARF_TERMS.healthProvider.label} (Health Check URL)</label>
              <input
                type="text"
                value={pm2Config.healthUrl}
                onChange={(e) => onChangePm2Config({ ...pm2Config, healthUrl: e.target.value })}
                placeholder="http://127.0.0.1:3000/"
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{SETUP_EXPLANATIONS.healthProvider}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Deployment Layout</label>
              <select
                value={pm2Config.layout}
                onChange={(e) => onChangePm2Config({ ...pm2Config, layout: e.target.value as "releases" | "git" })}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              >
                <option value="git">git (in-place repo checkout)</option>
                <option value="releases">releases (Capistrano-style current/ symlink)</option>
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">How releases are deployed on server</p>
            </div>
            {pm2Config.layout === "git" && <div className="md:col-span-2">
              <label htmlFor="pm2-build-command" className="text-xs font-medium text-foreground">Build command after checkout</label>
              <Input id="pm2-build-command" type="text" value={pm2Config.buildCommand} onChange={(event) => onChangePm2Config({ ...pm2Config, buildCommand: event.target.value })} placeholder="npm ci && npm run build" className="mt-1 font-mono text-xs" />
              <p className="mt-1 text-[11px] text-muted-foreground">Runs from the working directory for deployment and rollback. Use npm ci &amp;&amp; npm run build for Next.js, or true for apps without a build step.</p>
            </div>}
          </div>
        </div>
      )}

      {/* Inline Docker Configuration when Docker is selected */}
      {selectedAdapter === "docker" && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.03] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="size-4 text-sky-500" />
              <h3 className="text-sm font-semibold text-foreground">Docker Configuration &amp; {CARF_TERMS.deploymentTarget.label}</h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure how {CARF_TERMS.core.label} interacts with Docker or Docker Compose on this host.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-foreground">{CARF_TERMS.deploymentTarget.label} (Container / Service Name)</label>
              <input
                type="text"
                value={dockerConfig.containerName}
                onChange={(e) => onChangeDockerConfig({ ...dockerConfig, containerName: e.target.value })}
                placeholder={selectedRepo?.name ? `${selectedRepo.name}-web-1` : "monix-web-1"}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{SETUP_EXPLANATIONS.deploymentTarget}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Compose File Path (optional)</label>
              <input
                type="text"
                value={dockerConfig.composeFile}
                onChange={(e) => onChangeDockerConfig({ ...dockerConfig, composeFile: e.target.value })}
                placeholder="docker-compose.yml"
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Path to compose file (leave empty if using standalone containers)</p>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-foreground">{CARF_TERMS.healthProvider.label} (Health Check URL)</label>
              <input
                type="text"
                value={dockerConfig.healthUrl}
                onChange={(e) => onChangeDockerConfig({ ...dockerConfig, healthUrl: e.target.value })}
                placeholder="http://127.0.0.1:3100/api/health"
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{SETUP_EXPLANATIONS.healthProvider}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <span>Next: Configuration Review</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
