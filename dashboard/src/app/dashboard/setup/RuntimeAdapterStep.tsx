"use client";

import React from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Shield, Server, Box, Layers, Cpu } from "lucide-react";
import type { InstallationRepo } from "../../../adapters/github/reposClient";
import type { RuntimeAdapter } from "../../../lib/capabilities";

interface RuntimeAdapterStepProps {
  selectedRepo: InstallationRepo | null;
  selectedAdapter: RuntimeAdapter;
  onSelectAdapter: (adapter: RuntimeAdapter) => void;
  pm2Config: {
    targetName: string;
    cwd: string;
    healthUrl: string;
    layout: "releases" | "git";
  };
  onChangePm2Config: (config: {
    targetName: string;
    cwd: string;
    healthUrl: string;
    layout: "releases" | "git";
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

const ADAPTER_OPTIONS: AdapterOption[] = [
  {
    id: "none",
    name: "No Direct Runtime (Policy Only)",
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
      "Continuous health URL probing during observation window",
      "Automated symlink / git rollback on threshold breach",
      "Lightweight CARF Host Agent on target server",
    ],
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    tag: "Roadmap · Preview",
    tagColor: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    icon: Layers,
    description: "In development. Direct pod and deployment rollback controller for cluster environments.",
    features: [
      "Policy-guided threshold evaluation currently active",
      "Live rollback adapter scheduled for next release",
      "No host agent required",
    ],
  },
  {
    id: "docker",
    name: "Docker / Docker Compose",
    tag: "Roadmap · Preview",
    tagColor: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
    icon: Box,
    description: "In development. Container image rollback and health check monitoring.",
    features: [
      "Policy-guided threshold evaluation currently active",
      "Live rollback adapter scheduled for next release",
      "No host agent required",
    ],
  },
  {
    id: "systemd",
    name: "systemd Services",
    tag: "Roadmap · Preview",
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
  selectedRepo,
  selectedAdapter,
  onSelectAdapter,
  pm2Config,
  onChangePm2Config,
  onBack,
  onContinue,
}: RuntimeAdapterStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <span>Step 3</span>
          <span>•</span>
          <span>Layer 3: Runtime / Control Adapter</span>
        </div>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
          Choose Runtime Adapter
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Determine if CARF should execute automated rollbacks directly on the server runtime, or deliver policies to your deployment system.
        </p>
      </div>

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

                <ul className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                  {opt.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
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
          <div className="flex items-center gap-2">
            <Server className="size-4 text-sky-500" />
            <h3 className="text-sm font-semibold text-foreground">PM2 Process Details</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure how the CARF Host Agent targets and verifies your PM2 application on the production server.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-foreground">PM2 Process Name</label>
              <input
                type="text"
                value={pm2Config.targetName}
                onChange={(e) => onChangePm2Config({ ...pm2Config, targetName: e.target.value })}
                placeholder={selectedRepo?.name ?? "my-app"}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Name in `pm2 status`</p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Working Directory (cwd)</label>
              <input
                type="text"
                value={pm2Config.cwd}
                onChange={(e) => onChangePm2Config({ ...pm2Config, cwd: e.target.value })}
                placeholder={`/opt/${selectedRepo?.name ?? "app"}`}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Absolute path to application root</p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Health Check URL</label>
              <input
                type="text"
                value={pm2Config.healthUrl}
                onChange={(e) => onChangePm2Config({ ...pm2Config, healthUrl: e.target.value })}
                placeholder="http://127.0.0.1:3000/healthz"
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Endpoint polled during soak window</p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Deployment Layout</label>
              <select
                value={pm2Config.layout}
                onChange={(e) => onChangePm2Config({ ...pm2Config, layout: e.target.value as "releases" | "git" })}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="git">Git In-Place (git checkout & pull)</option>
                <option value="releases">Symlinked Releases (/releases/ + current)</option>
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">How releases are organized on disk</p>
            </div>
          </div>
        </div>
      )}

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
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <span>Next: Live Capabilities</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
