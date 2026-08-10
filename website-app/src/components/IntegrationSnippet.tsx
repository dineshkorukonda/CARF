"use client";

import { useState } from "react";
import { Check, Copy, FileCode, Terminal } from "lucide-react";

export function IntegrationSnippet() {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const carfYaml = `# .carf.yml
version: "1.0"
project_id: checkout-service-v2

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
      - name: Deploy
        run: kubectl apply -f k8s/

      - name: CARF Evaluate
        uses: carf-devops/evaluate-action@v1.2
        with:
          api-key: \${{ secrets.CARF_API_KEY }}
          commit-sha: \${{ github.sha }}`;

  const handleCopy = (text: string, fileName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(fileName);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const blocks = [
    {
      id: ".carf.yml",
      icon: FileCode,
      badge: "Config",
      code: carfYaml,
      caption: "Defines change sensitivity",
      step: "Step 1 of 2",
    },
    {
      id: "deploy.yml",
      icon: Terminal,
      badge: "CI Action",
      code: githubActionYaml,
      caption: "Opens the post-deploy window",
      step: "Step 2 of 2",
    },
  ];

  return (
    <section id="integration" className="py-24 sm:py-28 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 text-[#f56031] mb-4">
            <span className="font-mono text-xs uppercase tracking-[0.18em]">Integration</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            Two files. Zero rewrite.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-neutral-400 leading-relaxed">
            Drops into GitHub Actions, GitLab CI, CircleCI, or ArgoCD without replacing your build
            or runtime.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {blocks.map((block) => {
            const Icon = block.icon;
            return (
              <div
                key={block.id}
                className="rounded-[28px] overflow-hidden border border-white/10 bg-zinc-900/40"
              >
                <div className="bg-hatch px-4 py-3 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-2 text-sm text-zinc-200">
                    <Icon className="h-4 w-4 text-[#f56031]" />
                    <span className="font-medium">{block.id}</span>
                    <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-zinc-400">
                      {block.badge}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(block.code, block.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black hover:bg-zinc-100"
                  >
                    {copiedFile === block.id ? (
                      <>
                        <Check className="h-3 w-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-[#f4f4f0] text-black p-4 font-mono text-xs leading-relaxed overflow-x-auto min-h-[280px]">
                  {block.code.split("\n").map((line, idx) => (
                    <div key={idx} className="flex">
                      <span className="w-7 select-none text-black/25 text-right pr-3">
                        {idx + 1}
                      </span>
                      <span className={line.trim().startsWith("#") ? "text-black/40 italic" : ""}>
                        {line}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-[11px] font-mono text-zinc-400 border-t border-white/10">
                  <span>{block.caption}</span>
                  <span className="text-[#f56031]">{block.step}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-[#58de54]" />
            Two additions to your pipeline. Nothing to migrate.
          </div>
        </div>
      </div>
    </section>
  );
}
