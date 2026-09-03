"use client";

import { useState } from "react";
import { Activity, Box, Container, Layers, LayoutDashboard, Server, Terminal } from "lucide-react";

export function SupportedTargets() {
  const [activeTab, setActiveTab] = useState<"standalone" | "augment">("standalone");

  const standaloneTargets = [
    {
      name: "Docker Compose",
      type: "Standalone Adapter",
      icon: Container,
      method: "docker compose up -d",
      protocol: "Docker Engine API / CLI",
      badge: "Native Engine",
      description:
        "Inspects container health checks via 'docker compose ps'. Automatically redeploys previous image tags on threshold breach.",
    },
    {
      name: "Docker Swarm",
      type: "Standalone Adapter",
      icon: Box,
      method: "docker service update --rollback",
      protocol: "Swarm Manager CLI",
      badge: "Native Engine",
      description:
        "Monitors active task states and triggers Swarm's native rolling rollback to the previous task definition automatically.",
    },
    {
      name: "PM2 Process Manager",
      type: "Standalone Adapter",
      icon: Terminal,
      method: "pm2 reload + symlink switch",
      protocol: "Process Daemon",
      badge: "Native Engine",
      description:
        "Inspects cluster worker health with 'pm2 jlist', switches /var/www/current symlink, and reloads processes with zero downtime.",
    },
    {
      name: "Kubernetes (kubectl)",
      type: "Standalone Adapter",
      icon: Server,
      method: "kubectl rollout undo",
      protocol: "Kubernetes API / CLI",
      badge: "Native Engine",
      description:
        "Tracks Pod and Deployment replica readiness. Triggers an automated 'rollout undo' when canary error budgets are exceeded.",
    },
  ];

  const augmentTargets = [
    {
      name: "Argo Rollouts",
      type: "Progressive Delivery",
      icon: Server,
      method: "AnalysisTemplate Webhook",
      protocol: "HTTP API (Bearer Token)",
      badge: "Native Augment",
      description:
        "CARF responds to Argo Rollouts mid-canary step to dynamically tune error thresholds based on commit risk vectors.",
    },
    {
      name: "Flagger",
      type: "Progressive Delivery",
      icon: Layers,
      method: "Webhook Metric Provider",
      protocol: "HTTP API (Bearer Token)",
      badge: "Native Augment",
      description:
        "Plugs directly into Flagger's canary webhook metric provider to dynamically adjust error margins for each deployment.",
    },
    {
      name: "Prometheus",
      type: "Metrics Backend",
      icon: Activity,
      method: "PromQL query",
      protocol: "HTTP API",
      badge: "Telemetry Source",
      description:
        "CARF queries baseline error and latency distributions from Prometheus to calibrate dynamic thresholds against historical noise.",
    },
    {
      name: "Datadog",
      type: "Metrics Backend",
      icon: LayoutDashboard,
      method: "Metrics API",
      protocol: "HTTP API",
      badge: "Telemetry Source",
      description:
        "Correlates runtime APM and error tracking data with git commit complexity vectors to guard production deployments.",
    },
  ];

  const currentTargets = activeTab === "standalone" ? standaloneTargets : augmentTargets;

  return (
    <section id="targets" className="py-24 sm:py-28 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[#f56031] mb-4">
              <span className="font-mono text-xs uppercase tracking-[0.18em]">Deployment Targets</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
              Supported deployment engines & tools
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-400 leading-relaxed">
              Use CARF Standalone to execute automated rollbacks directly, or Augment mode to plug dynamic thresholds into your existing orchestrator.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="inline-flex rounded-full bg-white/5 p-1 border border-white/10 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("standalone")}
              className={`rounded-full px-4 py-2 text-xs font-medium font-mono transition-colors ${
                activeTab === "standalone"
                  ? "bg-[#f56031] text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Standalone Adapters (Direct Rollback)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("augment")}
              className={`rounded-full px-4 py-2 text-xs font-medium font-mono transition-colors ${
                activeTab === "augment"
                  ? "bg-[#f56031] text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Augment Mode (Argo / Flagger / Telemetry)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {currentTargets.map((target) => {
            const Icon = target.icon;
            return (
              <div
                key={target.name}
                className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5 hover:border-[#f56031]/40 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f56031]/10 text-[#f56031] border border-[#f56031]/20">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{target.name}</h3>
                      <span className="text-[11px] font-mono text-zinc-500">{target.type}</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-black">
                    {target.badge}
                  </span>
                </div>

                <p className="text-sm text-neutral-400 leading-relaxed mb-4">
                  {target.description}
                </p>

                <div className="pt-3 border-t border-white/10 font-mono text-[11px] text-zinc-500 space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <span>Action / Command</span>
                    <span className="text-zinc-300 text-right">{target.method}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Interface</span>
                    <span className="text-zinc-400 text-right">{target.protocol}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
