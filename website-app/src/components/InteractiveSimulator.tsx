"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  GitPullRequest,
  Server,
  Terminal,
} from "lucide-react";

type ScenarioKey = "infra" | "config" | "dependency" | "code";
type TargetRuntime = "kubernetes" | "pm2" | "argocd" | "docker";

interface Scenario {
  key: ScenarioKey;
  title: string;
  category: string;
  sensitivity: string;
  window: string;
  threshold: number;
  diffSnippet: string;
}

export function InteractiveSimulator() {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("infra");
  const [targetRuntime, setTargetRuntime] = useState<TargetRuntime>("kubernetes");
  const [errorRate, setErrorRate] = useState(0.38);
  const [logs, setLogs] = useState<string[]>([]);

  const scenarios: Record<ScenarioKey, Scenario> = {
    infra: {
      key: "infra",
      title: "Ingress YAML edit",
      category: "INFRASTRUCTURE",
      sensitivity: "Strictest",
      window: "60 seconds",
      threshold: 0.2,
      diffSnippet:
        "--- a/k8s/ingress.yaml\n+++ b/k8s/ingress.yaml\n- path: /api/v1\n+ path: /api/v2",
    },
    config: {
      key: "config",
      title: "DB pool overhaul",
      category: "CONFIG",
      sensitivity: "Medium",
      window: "5 minutes",
      threshold: 2.5,
      diffSnippet:
        "--- a/config/production.env\n+++ b/config/production.env\n- DATABASE_POOL_MAX=20\n+ DATABASE_POOL_MAX=5000",
    },
    dependency: {
      key: "dependency",
      title: "Major package bump",
      category: "DEPENDENCY",
      sensitivity: "High",
      window: "3 minutes",
      threshold: 1.0,
      diffSnippet:
        '--- a/package.json\n+++ b/package.json\n- "express-session": "1.17.3"\n+ "express-session": "2.0.0-rc1"',
    },
    code: {
      key: "code",
      title: "Controller response",
      category: "CODE",
      sensitivity: "Low",
      window: "15 minutes",
      threshold: 5.0,
      diffSnippet:
        '--- a/src/controllers/user.ts\n+++ b/src/controllers/user.ts\n- return res.json({ status: "ok" });\n+ return res.json({ status: "success" });',
    },
  };

  const current = scenarios[selectedScenario];
  const isBreached = errorRate > current.threshold;

  const runtimeCommands: Record<TargetRuntime, string> = {
    kubernetes: "kubectl rollout undo deployment/checkout-api -n production",
    pm2: "pm2 reload checkout-api --update-env",
    argocd: 'git revert HEAD && git push origin main',
    docker: "docker service update --image registry/api:v1.41 checkout_service",
  };

  useEffect(() => {
    setLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] HTTP 5xx=${errorRate.toFixed(2)}% · threshold ${current.threshold.toFixed(2)}%`,
      ...prev.slice(0, 6),
    ]);
  }, [errorRate, current.threshold]);

  const handleScenarioChange = (key: ScenarioKey) => {
    setSelectedScenario(key);
    if (key === "infra") setErrorRate(0.38);
    else if (key === "config") setErrorRate(2.85);
    else if (key === "dependency") setErrorRate(1.45);
    else setErrorRate(1.2);
  };

  return (
    <section id="interactive-demo" className="py-24 sm:py-28 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 text-[#f56031] mb-4">
            <span className="font-mono text-xs uppercase tracking-[0.18em]">Simulator</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            Test CARF in real time.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-neutral-400 leading-relaxed">
            Pick a change vector, drag the post-deploy error rate, and watch the decision engine
            classify, score, and roll back — or stand down.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#f56031]">
                1. Change scenario
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(scenarios) as ScenarioKey[]).map((key) => {
                  const s = scenarios[key];
                  const active = selectedScenario === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleScenarioChange(key)}
                      className={`rounded-2xl border p-3 text-left transition ${
                        active
                          ? "border-[#f56031]/50 bg-[#f56031]/10 text-white"
                          : "border-white/10 bg-black/40 text-zinc-400 hover:border-white/20"
                      }`}
                    >
                      <div className="text-[10px] font-mono text-[#f56031] mb-1">{s.category}</div>
                      <div className="text-sm font-medium">{s.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#f56031]">
                  2. Error rate
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-mono font-semibold ${
                    isBreached
                      ? "bg-[#f56031] text-black"
                      : "bg-[#58de54]/20 text-[#58de54]"
                  }`}
                >
                  {errorRate.toFixed(2)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="0.05"
                value={errorRate}
                onChange={(e) => setErrorRate(parseFloat(e.target.value))}
                className="w-full accent-[#f56031]"
              />
              <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                <span>0.0%</span>
                <span className="text-[#f56031]">ceil {current.threshold.toFixed(2)}%</span>
                <span>6.0%</span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#f56031]">
                3. Runtime
              </div>
              <div className="grid grid-cols-4 gap-2">
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
                      type="button"
                      onClick={() => setTargetRuntime(r.id as TargetRuntime)}
                      className={`rounded-2xl border p-2.5 flex flex-col items-center gap-1 transition ${
                        active
                          ? "border-[#f56031]/50 bg-[#f56031]/10 text-[#f56031]"
                          : "border-white/10 text-zinc-400 hover:border-white/20"
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

          <div className="lg:col-span-7">
            <div className="rounded-[28px] overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
              <div className="bg-hatch px-4 py-3 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2 text-sm text-zinc-200">
                  <Activity className="h-4 w-4 text-[#f56031]" />
                  Decision stream
                </div>
                <span className="rounded-full bg-[#f56031] px-3 py-1 text-[11px] font-semibold text-black">
                  {current.category} · {current.sensitivity}
                </span>
              </div>

              <div className="bg-[#f4f4f0] text-black">
                <div className="px-5 py-4 border-b border-black/10">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-black/40 mb-2">
                    Parsed diff · window {current.window}
                  </div>
                  <pre className="rounded-2xl bg-black text-zinc-200 p-3 text-[11px] leading-relaxed overflow-x-auto">
                    {current.diffSnippet}
                  </pre>
                </div>

                <div className="px-5 py-4 border-b border-black/10">
                  {isBreached ? (
                    <div className="rounded-2xl border border-[#f56031]/40 bg-[#f56031]/10 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle className="h-5 w-5 text-[#f56031]" />
                        <div>
                          <div className="text-sm font-semibold">Automated rollback triggered</div>
                          <div className="text-xs text-black/55">
                            {errorRate.toFixed(2)}% crossed {current.threshold.toFixed(2)}% ceiling
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono rounded-full bg-black text-white px-2.5 py-1">
                        380ms
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#58de54]/30 bg-[#58de54]/10 px-4 py-3 flex items-center gap-2.5">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <div>
                        <div className="text-sm font-semibold">Deployment healthy</div>
                        <div className="text-xs text-black/55">
                          Within {current.category} tolerance
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-black/40 mb-1">
                      Runtime command
                    </div>
                    <div className="rounded-2xl bg-black text-[#f56031] font-mono text-xs px-3 py-2.5 overflow-x-auto">
                      {isBreached
                        ? runtimeCommands[targetRuntime]
                        : "# monitoring… no command dispatched"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-black/40 mb-1">
                      Event log
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-[11px] text-black/55">
                      {logs.map((log, i) => (
                        <div key={`${log}-${i}`} className="border-l-2 border-[#f56031]/40 pl-2">
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
      </div>
    </section>
  );
}
