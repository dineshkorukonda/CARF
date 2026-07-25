"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, ArrowRight, Activity, RefreshCw, AlertTriangle, FileText, ExternalLink } from "lucide-react";

export function Hero() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"config" | "action" | "live">("config");
  const [simState, setSimState] = useState<"idle" | "evaluating" | "decision">("idle");
  const [simLog, setSimLog] = useState<string[]>([]);

  const paperUrl = "https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing";

  const carfConfigContent = `# .carf.yml — Change-Aware Rollback Configuration
version: "1.0"
project: checkout-service-api

# Adaptive thresholds per change type
change_sensitivity:
  infrastructure:
    window: 60s
    error_rate_threshold: 0.2%
    action: immediate_rollback
  
  dependency:
    window: 3m
    error_rate_threshold: 1.0%
    action: rollback_on_confidence

  config:
    window: 5m
    error_rate_threshold: 2.5%
    action: rollback_with_alert

  code:
    window: 15m
    error_rate_threshold: 5.0%
    action: alert_on_threshold

target:
  provider: kubernetes
  namespace: production
  deployment: checkout-api-v2`;

  const githubActionContent = `# .github/workflows/deploy.yml
name: Production Deployment

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Kubernetes
        run: kubectl apply -f k8s/
        
      - name: CARF Change-Aware Monitor
        uses: carf-devops/action-evaluate@v1
        with:
          carf-token: \${{ secrets.CARF_TOKEN }}
          commit-sha: \${{ github.sha }}`;

  const currentSnippet = activeTab === "config" ? carfConfigContent : githubActionContent;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runSimulation = () => {
    setSimState("evaluating");
    setSimLog([
      "09:57:38 [CARF-AGENT] Git diff received (SHA: 8f2a9d1)",
      "09:57:38 [CLASSIFIER] Diff parsed: 2 files changed in /helm/templates/ingress.yaml",
      "09:57:38 [CLASSIFIER] Classified change type: INFRASTRUCTURE (Strict sensitivity)",
      "09:57:39 [MONITOR] Telemetry stream attached (Window: 60s, Baseline: 0.04%)",
      "09:57:42 [MONITOR] Post-deploy HTTP 5xx spike detected: 0.38%",
      "09:57:43 [DECISION] Threshold crossed (0.38% > 0.20% max allowed for INFRA)",
      "09:57:44 [EXECUTION] Triggering zero-downtime rollback -> Helm revision 142 restored in 420ms."
    ]);
    setTimeout(() => {
      setSimState("decision");
    }, 1400);
  };

  return (
    <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 border-b border-zinc-800/60 overflow-hidden bg-grid-pattern">
      {/* Background glow subtle radial backdrop */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-cyan-950/20 blur-[120px] pointer-events-none rounded-full" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-mono text-[11px] text-zinc-400">RESEARCH & DEVOPS ENGINE</span>
              <span className="text-zinc-600">|</span>
              <a
                href={paperUrl}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline inline-flex items-center gap-1 font-medium text-[11.5px]"
              >
                <span>Read Conference Paper</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-5xl font-bold tracking-tight text-white font-sans leading-[1.12]">
              Rollback decisions that understand <span className="text-cyan-400">what changed</span>.
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed max-w-2xl">
              CARF evaluates deployment risk based on change type — <span className="text-zinc-200 font-medium">code</span>, <span className="text-zinc-200 font-medium">config</span>, <span className="text-zinc-200 font-medium">dependency</span>, or <span className="text-zinc-200 font-medium">infrastructure</span> — applying adaptive sensitivity thresholds instead of treating every failure with a flat error percentage.
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded border border-cyan-400/50 bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition-all group"
              >
                <span>View docs</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <a
                href={paperUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all font-mono"
              >
                <FileText className="h-4 w-4 text-cyan-400" />
                <span>Conference Paper (PDF)</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </div>

            {/* Quick Proof Points */}
            <div className="pt-4 grid grid-cols-3 gap-4 border-t border-zinc-800/80 text-xs font-mono text-zinc-400">
              <div>
                <div className="text-zinc-200 font-semibold text-sm">4 Change Types</div>
                <div className="text-zinc-500 text-[11px] font-sans">AST & Git diff parser</div>
              </div>
              <div>
                <div className="text-zinc-200 font-semibold text-sm">&lt; 500ms</div>
                <div className="text-zinc-500 text-[11px] font-sans">Rollback execution time</div>
              </div>
              <div>
                <div className="text-zinc-200 font-semibold text-sm">Peer Reviewed</div>
                <div className="text-zinc-500 text-[11px] font-sans">Published Research Paper</div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Code Terminal */}
          <div className="lg:col-span-6">
            <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] shadow-2xl overflow-hidden font-mono text-xs">
              
              {/* Terminal Header Bar */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono ml-2">carf-control-plane</span>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded border border-zinc-800">
                  <button
                    onClick={() => setActiveTab("config")}
                    className={`px-2.5 py-1 text-[11px] rounded transition-all ${
                      activeTab === "config"
                        ? "bg-zinc-800 text-cyan-400 font-medium"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    .carf.yml
                  </button>
                  <button
                    onClick={() => setActiveTab("action")}
                    className={`px-2.5 py-1 text-[11px] rounded transition-all ${
                      activeTab === "action"
                        ? "bg-zinc-800 text-cyan-400 font-medium"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    deploy.yml
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("live");
                      if (simState === "idle") runSimulation();
                    }}
                    className={`px-2.5 py-1 text-[11px] rounded transition-all flex items-center gap-1 ${
                      activeTab === "live"
                        ? "bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-medium"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                    Live Trace
                  </button>
                </div>
              </div>

              {/* Terminal Body */}
              <div className="p-4 bg-[#09090c] min-h-[340px] flex flex-col justify-between overflow-x-auto relative">
                {activeTab !== "live" ? (
                  <>
                    <div className="space-y-1 text-zinc-300 leading-relaxed font-mono">
                      {currentSnippet.split("\n").map((line, idx) => {
                        const isComment = line.trim().startsWith("#");
                        const isKey = line.includes(":");
                        return (
                          <div key={idx} className="flex">
                            <span className="w-8 select-none text-zinc-600 text-right pr-3">{idx + 1}</span>
                            <span className={isComment ? "text-zinc-500 italic" : "text-zinc-200"}>
                              {isKey && !isComment ? (
                                <>
                                  <span className="text-cyan-400">{line.split(":")[0]}:</span>
                                  <span className="text-zinc-300">{line.slice(line.indexOf(":") + 1)}</span>
                                </>
                              ) : (
                                line
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">YAML config · Strict schema validation</span>
                      <button
                        onClick={copyToClipboard}
                        className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors"
                      >
                        {copied ? <Check className="h-3 w-3 text-cyan-400" /> : <Copy className="h-3 w-3" />}
                        <span>{copied ? "Copied!" : "Copy Snippet"}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 font-mono">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 text-xs">
                      <div className="flex items-center gap-2 text-cyan-400">
                        <Activity className="h-4 w-4" />
                        <span>Real-time Change Decision Engine</span>
                      </div>
                      <button
                        onClick={runSimulation}
                        className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-white"
                      >
                        <RefreshCw className="h-3 w-3" /> Re-run Trace
                      </button>
                    </div>

                    <div className="space-y-1.5 text-[11.5px] leading-relaxed">
                      {simLog.map((log, i) => (
                        <div
                          key={i}
                          className={`p-1.5 rounded ${
                            log.includes("EXECUTION")
                              ? "bg-red-950/30 border border-red-800/40 text-red-300"
                              : log.includes("CLASSIFIER")
                              ? "bg-cyan-950/30 border border-cyan-900/40 text-cyan-300"
                              : log.includes("DECISION")
                              ? "text-amber-300"
                              : "text-zinc-400"
                          }`}
                        >
                          {log}
                        </div>
                      ))}
                    </div>

                    {simState === "decision" && (
                      <div className="mt-2 p-2.5 rounded border border-red-900/50 bg-red-950/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-red-400 font-medium">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          <span>AUTOMATED ROLLBACK EXECUTED (Revision 142)</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">Latency: 420ms</span>
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
