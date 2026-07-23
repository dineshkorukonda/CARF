"use client";

import { useState } from "react";
import { Check, Copy, Terminal, FileCode, CheckCircle2 } from "lucide-react";

export function IntegrationSnippet() {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const carfYaml = `# .carf.yml — Repository Root Configuration
version: "1.0"
project_id: checkout-service-v2

# Per-change-type risk sensitivity
sensitivity_rules:
  infrastructure:
    window: 60s
    error_threshold: 0.2%
    action: immediate_rollback
  config:
    window: 5m
    error_threshold: 2.5%
    action: rollback_with_alert
  code:
    window: 15m
    error_threshold: 5.0%
    action: alert_on_threshold

target:
  runtime: kubernetes
  namespace: production
  deployment: checkout-api`;

  const githubActionYaml = `# .github/workflows/deploy.yml
name: Production Deployment

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Kubernetes Cluster
        run: kubectl apply -f k8s/manifests/

      - name: CARF Change-Aware Evaluation
        uses: carf-devops/evaluate-action@v1.2
        with:
          api-key: \${{ secrets.CARF_API_KEY }}
          commit-sha: \${{ github.sha }}`;

  const handleCopy = (text: string, fileName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(fileName);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  return (
    <section id="integration" className="py-20 border-b border-zinc-800/60 bg-[#08080a]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 mb-3 uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            ZERO ARCHITECTURAL REWRITE
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            Integration takes 2 minutes.
          </h2>
          <p className="mt-3 text-base text-zinc-400 leading-relaxed">
            Plugs seamlessly into GitHub Actions, GitLab CI, CircleCI, or ArgoCD without replacing your existing build or container runtimes.
          </p>
        </div>

        {/* Side-by-Side Code Blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* File 1: .carf.yml */}
          <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] overflow-hidden flex flex-col justify-between">
            <div>
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2.5 font-mono text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-cyan-400" />
                  <span className="font-medium text-white">.carf.yml</span>
                  <span className="text-[10px] text-zinc-500 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.2">Project Config</span>
                </div>
                <button
                  onClick={() => handleCopy(carfYaml, ".carf.yml")}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
                >
                  {copiedFile === ".carf.yml" ? (
                    <>
                      <Check className="h-3 w-3 text-cyan-400" />
                      <span className="text-cyan-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code */}
              <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto text-zinc-300">
                {carfYaml.split("\n").map((line, idx) => (
                  <div key={idx} className="flex">
                    <span className="w-8 select-none text-zinc-600 text-right pr-3">{idx + 1}</span>
                    <span className={line.trim().startsWith("#") ? "text-zinc-500 italic" : "text-zinc-200"}>
                      {line}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60 font-mono text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Defines change sensitivity & thresholds</span>
              <span className="text-cyan-400">Step 1 of 2</span>
            </div>
          </div>

          {/* File 2: CI Workflow Action */}
          <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] overflow-hidden flex flex-col justify-between">
            <div>
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2.5 font-mono text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-cyan-400" />
                  <span className="font-medium text-white">.github/workflows/deploy.yml</span>
                  <span className="text-[10px] text-zinc-500 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.2">CI Action</span>
                </div>
                <button
                  onClick={() => handleCopy(githubActionYaml, "deploy.yml")}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
                >
                  {copiedFile === "deploy.yml" ? (
                    <>
                      <Check className="h-3 w-3 text-cyan-400" />
                      <span className="text-cyan-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code */}
              <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto text-zinc-300">
                {githubActionYaml.split("\n").map((line, idx) => (
                  <div key={idx} className="flex">
                    <span className="w-8 select-none text-zinc-600 text-right pr-3">{idx + 1}</span>
                    <span className={line.trim().startsWith("#") ? "text-zinc-500 italic" : "text-zinc-200"}>
                      {line}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60 font-mono text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Triggers post-deploy trace window</span>
              <span className="text-cyan-400">Step 2 of 2</span>
            </div>
          </div>

        </div>

        {/* Required Caption */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-4 py-2 text-xs font-mono text-zinc-300">
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
            <span>Two additions to your existing pipeline. Nothing to migrate.</span>
          </div>
        </div>

      </div>
    </section>
  );
}
