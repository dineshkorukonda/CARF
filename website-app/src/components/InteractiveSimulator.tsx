"use client";

import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Activity,
  GitBranch,
  Cpu,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Terminal,
  Zap,
  Layers,
  Box,
  Server,
  GitPullRequest
} from "lucide-react";

type ScenarioKey = "infra" | "config" | "dependency" | "code";
type TargetRuntime = "kubernetes" | "pm2" | "argocd" | "docker";

interface Scenario {
  key: ScenarioKey;
  title: string;
  category: string;
  sensitivity: string;
  sensitivityColor: string;
  window: string;
  threshold: number;
  diffSnippet: string;
  description: string;
}

export function InteractiveSimulator() {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("infra");
  const [targetRuntime, setTargetRuntime] = useState<TargetRuntime>("kubernetes");
  const [errorRate, setErrorRate] = useState<number>(0.38); // Simulated error rate %
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [stepIndex, setStepIndex] = useState<number>(3); // 0: Classify, 1: Monitor, 2: Decide, 3: Executed
  const [logs, setLogs] = useState<string[]>([]);

  const scenarios: Record<ScenarioKey, Scenario> = {
    infra: {
      key: "infra",
      title: "Kubernetes Ingress YAML Edit",
      category: "INFRASTRUCTURE",
      sensitivity: "Strictest",
      sensitivityColor: "text-red-400 border-red-800/60 bg-red-950/30",
      window: "60 seconds",
      threshold: 0.20,
      diffSnippet: `--- a/k8s/ingress.yaml\n+++ b/k8s/ingress.yaml\n@@ -12,2 +12,2 @@\n- path: /api/v1\n+ path: /api/v2 # Breaks 100% of proxy traffic`,
      description: "Routing and ingress proxy changes have zero tolerance for post-deploy errors.",
    },
    config: {
      key: "config",
      title: "DB Pool Max Conn Overhaul",
      category: "CONFIG",
      sensitivity: "Medium",
      sensitivityColor: "text-amber-300 border-amber-800/50 bg-amber-950/20",
      window: "5 minutes",
      threshold: 2.50,
      diffSnippet: `--- a/config/production.env\n+++ b/config/production.env\n@@ -8,2 +8,2 @@\n- DATABASE_POOL_MAX=20\n+ DATABASE_POOL_MAX=5000 # Exhausts Postgres connections`,
      description: "Environment variables and database configuration changes trigger fast rollbacks.",
    },
    dependency: {
      key: "dependency",
      title: "Major Version Package Bump",
      category: "DEPENDENCY",
      sensitivity: "High",
      sensitivityColor: "text-cyan-300 border-cyan-800/50 bg-cyan-950/20",
      window: "3 minutes",
      threshold: 1.00,
      diffSnippet: `--- a/package.json\n+++ b/package.json\n@@ -14,2 +14,2 @@\n- "express-session": "1.17.3"\n+ "express-session": "2.0.0-rc1" # Native memory leak`,
      description: "Package lockfile updates undergo strict 3-minute monitoring for unhandled exceptions.",
    },
    code: {
      key: "code",
      title: "User Controller Response Format",
      category: "CODE",
      sensitivity: "Low",
      sensitivityColor: "text-zinc-300 border-zinc-700 bg-zinc-900/60",
      window: "15 minutes",
      threshold: 5.00,
      diffSnippet: `--- a/src/controllers/user.ts\n+++ b/src/controllers/user.ts\n@@ -40,2 +40,2 @@\n- return res.status(200).json({ status: "ok" });\n+ return res.status(200).json({ status: "success" });`,
      description: "Application code changes allow wider tolerance so non-fatal bugs can be patched forward.",
    },
  };

  const currentScenario = scenarios[selectedScenario];
  const isBreached = errorRate > currentScenario.threshold;

  // Runtime command mapping
  const runtimeCommands: Record<TargetRuntime, string> = {
    kubernetes: `kubectl rollout undo deployment/checkout-api -n production`,
    pm2: `pm2 reload checkout-api --update-env`,
    argocd: `git revert HEAD -m "revert: CARF breach trigger" && git push origin main`,
    docker: `docker service update --image registry.internal/api:v1.41 checkout_service`,
  };

  useEffect(() => {
    if (isRunning) {
      setLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Telemetry tick: HTTP 5xx=${errorRate.toFixed(
          2
        )}% (Threshold: ${currentScenario.threshold.toFixed(2)}%)`,
        ...prev.slice(0, 8),
      ]);
    }
  }, [errorRate, isRunning, currentScenario.threshold]);

  const handleScenarioChange = (key: ScenarioKey) => {
    setSelectedScenario(key);
    // Set realistic default error rate based on scenario
    if (key === "infra") setErrorRate(0.38);
    else if (key === "config") setErrorRate(2.85);
    else if (key === "dependency") setErrorRate(1.45);
    else setErrorRate(1.20);
  };

  return (
    <section id="interactive-demo" className="py-20 border-b border-zinc-800/60 bg-[#070709] relative overflow-hidden">
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 mb-3 uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            LIVE FRAMEWORK SIMULATOR
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            Interactive Demonstration: Test CARF in Real Time
          </h2>
          <p className="mt-3 text-base text-zinc-400 leading-relaxed">
            Select a deployment scenario, adjust the post-deploy error rate slider, and watch how CARF's decision engine automatically classifies, monitors, and triggers a target rollback.
          </p>
        </div>

        {/* Playground Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Control Panel */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Step 1: Select Change Scenario */}
            <div className="rounded-lg border border-zinc-800 bg-[#0d0d10] p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="text-cyan-400 font-semibold uppercase">1. Select Change Scenario</span>
                <span>Git Diff Vector</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(scenarios) as ScenarioKey[]).map((key) => {
                  const s = scenarios[key];
                  const active = selectedScenario === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleScenarioChange(key)}
                      className={`p-3 rounded border text-left font-mono transition-all ${
                        active
                          ? "border-cyan-500/60 bg-cyan-950/30 text-white"
                          : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <div className="text-[10px] text-cyan-400 mb-1">{s.category}</div>
                      <div className="text-xs font-semibold truncate">{s.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Interactive Error Rate Slider */}
            <div className="rounded-lg border border-zinc-800 bg-[#0d0d10] p-5 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-semibold uppercase">2. Adjust Post-Deploy Error Rate</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  isBreached ? "bg-red-950 text-red-400 border border-red-800" : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                }`}>
                  {errorRate.toFixed(2)}% HTTP 5xx
                </span>
              </div>

              <div>
                <input
                  type="range"
                  min="0.0"
                  max="6.0"
                  step="0.05"
                  value={errorRate}
                  onChange={(e) => setErrorRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500 mt-1">
                  <span>0.0% (Clean)</span>
                  <span className="text-amber-400 font-semibold">Threshold: {currentScenario.threshold.toFixed(2)}%</span>
                  <span>6.0% (Outage)</span>
                </div>
              </div>

              <p className="text-xs text-zinc-400 font-sans">
                Drag the slider above the <strong className="text-amber-300 font-mono">{currentScenario.threshold.toFixed(2)}%</strong> threshold for <strong className="text-white">{currentScenario.category}</strong> to trigger an immediate automated rollback.
              </p>
            </div>

            {/* Step 3: Target Runtime Controller */}
            <div className="rounded-lg border border-zinc-800 bg-[#0d0d10] p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="text-cyan-400 font-semibold uppercase">3. Target Runtime Controller</span>
                <span>Rollback Provider</span>
              </div>

              <div className="grid grid-cols-4 gap-2 font-mono text-xs">
                {[
                  { id: "kubernetes", label: "K8s", icon: Server },
                  { id: "pm2", label: "PM2", icon: Terminal },
                  { id: "argocd", label: "GitOps", icon: GitPullRequest },
                  { id: "docker", label: "Docker", icon: Box },
                ].map((r) => {
                  const Icon = r.icon;
                  const active = targetRuntime === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setTargetRuntime(r.id as TargetRuntime)}
                      className={`p-2.5 rounded border flex flex-col items-center gap-1 transition-all ${
                        active
                          ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-300 font-bold"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px]">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Live Decision Simulator Monitor */}
          <div className="lg:col-span-7">
            <div className="rounded-lg border border-zinc-800 bg-[#0a0a0d] overflow-hidden font-mono text-xs shadow-2xl">
              
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Activity className="h-4 w-4 animate-pulse" />
                  <span className="font-semibold">CARF Decision Engine Stream</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${currentScenario.sensitivityColor}`}>
                    {currentScenario.category} · {currentScenario.sensitivity} Sensitivity
                  </span>
                </div>
              </div>

              {/* Parsed Diff Inspection */}
              <div className="p-4 bg-[#08080a] border-b border-zinc-800/80 space-y-2">
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>INPUT GIT DIFF (PARSED BY AST CLASSIFIER)</span>
                  <span>Window: {currentScenario.window}</span>
                </div>
                <pre className="p-3 rounded bg-zinc-950 border border-zinc-800 text-[11px] leading-relaxed text-zinc-300 overflow-x-auto">
                  {currentScenario.diffSnippet}
                </pre>
              </div>

              {/* Status Banner */}
              <div className="p-4 border-b border-zinc-800/80">
                {isBreached ? (
                  <div className="p-3.5 rounded border border-red-800/80 bg-red-950/40 text-red-300 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 font-semibold text-xs">
                      <AlertTriangle className="h-5 w-5 text-red-400 animate-bounce" />
                      <div>
                        <div>AUTOMATED ROLLBACK TRIGGERED</div>
                        <div className="text-[11px] text-red-400/80 font-normal">
                          HTTP 5xx Error ({errorRate.toFixed(2)}%) crossed {currentScenario.category} threshold ({currentScenario.threshold.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono bg-red-900/60 px-2 py-1 rounded border border-red-700">
                      MTTR: 380ms
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded border border-emerald-800/80 bg-emerald-950/30 text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 font-semibold text-xs">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <div>
                        <div>DEPLOYMENT HEALTHY — NO ROLLBACK NEEDED</div>
                        <div className="text-[11px] text-emerald-400/80 font-normal">
                          Error rate ({errorRate.toFixed(2)}%) is within allowed {currentScenario.category} tolerance ({currentScenario.threshold.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono bg-emerald-900/40 px-2 py-1 rounded border border-emerald-700">
                      Monitoring Active
                    </span>
                  </div>
                )}
              </div>

              {/* Executed Command & Telemetry Feed */}
              <div className="p-4 space-y-3 bg-[#070709]">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase mb-1">Target Runtime Command</div>
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-cyan-300 text-[11.5px] font-mono overflow-x-auto">
                    {isBreached ? runtimeCommands[targetRuntime] : "# Monitoring telemetry stream... No command dispatched."}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-zinc-500 uppercase mb-1">Real-time Event Log</div>
                  <div className="space-y-1 font-mono text-[11px] max-h-36 overflow-y-auto">
                    {logs.map((log, i) => (
                      <div key={i} className="text-zinc-400 border-l border-zinc-800 pl-2 py-0.5">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
