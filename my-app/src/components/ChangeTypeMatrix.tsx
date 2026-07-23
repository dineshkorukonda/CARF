"use client";

import { useState } from "react";
import { Code, Settings, Package, HardDrive, ShieldAlert, CheckCircle, ArrowRight, Zap, Filter } from "lucide-react";

export function ChangeTypeMatrix() {
  const [activeType, setActiveType] = useState<"code" | "config" | "dependency" | "infra">("infra");

  const matrixData = [
    {
      key: "code",
      type: "Code",
      icon: Code,
      sensitivity: "Low",
      sensitivityColor: "text-zinc-300 border-zinc-700 bg-zinc-900/60",
      window: "15 minutes",
      threshold: "5.0%",
      rollbackAction: "Alert & Log",
      rationale: "Allows non-critical feature bugs to be hotfixed forward without triggering disruptive automated rollbacks.",
      diffExample: `--- a/src/controllers/userController.ts
+++ b/src/controllers/userController.ts
@@ -42,3 +42,3 @@
- return res.status(200).json({ status: "ok" });
+ return res.status(200).json({ status: "success", version: "2.1" });`,
    },
    {
      key: "config",
      type: "Config",
      icon: Settings,
      sensitivity: "Medium",
      sensitivityColor: "text-amber-300 border-amber-800/50 bg-amber-950/20",
      window: "5 minutes",
      threshold: "2.5%",
      rollbackAction: "Rollback on breach",
      rationale: "Detects invalid environment variables, secret mismatches, or malformed feature flag JSON quickly.",
      diffExample: `--- a/config/production.env
+++ b/config/production.env
@@ -12,2 +12,2 @@
- DATABASE_POOL_MAX=20
+ DATABASE_POOL_MAX=2000 # Causing connection exhaustion`,
    },
    {
      key: "dependency",
      type: "Dependency",
      icon: Package,
      sensitivity: "High",
      sensitivityColor: "text-cyan-300 border-cyan-800/50 bg-cyan-950/20",
      window: "3 minutes",
      threshold: "1.0%",
      rollbackAction: "Rollback on breach",
      rationale: "Reverts lockfile updates or major version upgrades that introduce silent memory leaks or unhandled native exceptions.",
      diffExample: `--- a/package.json
+++ b/package.json
@@ -18,2 +18,2 @@
- "express-session": "1.17.3"
+ "express-session": "2.0.0-rc1" # Breaking API change`,
    },
    {
      key: "infra",
      type: "Infrastructure",
      icon: HardDrive,
      sensitivity: "Strictest",
      sensitivityColor: "text-red-400 border-red-800/60 bg-red-950/30",
      window: "60 seconds",
      threshold: "0.2%",
      rollbackAction: "Immediate Rollback",
      rationale: "Zero-tolerance policy. Ingress proxies, Terraform, Helm, or network mesh failures revert within seconds.",
      diffExample: `--- a/k8s/ingress.yaml
+++ b/k8s/ingress.yaml
@@ -15,2 +15,2 @@
- path: /api/v1
+ path: /api/v2 # Breaks 100% of legacy API ingress routing`,
    },
  ];

  const activeItem = matrixData.find((item) => item.key === activeType) || matrixData[3];

  return (
    <section id="sensitivity-matrix" className="py-20 border-b border-zinc-800/60 bg-[#060608]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 mb-3 uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            CORE DIFFERENTIATION
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            Why change-type matters: Adaptive sensitivity matrices
          </h2>
          <p className="mt-3 text-base text-zinc-400 leading-relaxed">
            Treating every deployment with the same flat threshold causes false alarms on minor code updates while missing critical infrastructure outages.
          </p>
        </div>

        {/* Structured Comparison Table */}
        <div className="rounded-lg border border-zinc-800 bg-[#0d0d10] overflow-hidden mb-12 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/80 font-mono text-[11px] text-zinc-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-medium">Change Type</th>
                  <th className="py-3.5 px-4 font-medium">Sensitivity</th>
                  <th className="py-3.5 px-4 font-medium">Monitoring Window</th>
                  <th className="py-3.5 px-4 font-medium">Error Threshold</th>
                  <th className="py-3.5 px-4 font-medium">CARF Automated Action</th>
                  <th className="py-3.5 px-4 font-medium hidden lg:table-cell">Engineering Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {matrixData.map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeType === item.key;
                  return (
                    <tr
                      key={item.key}
                      onClick={() => setActiveType(item.key as any)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-cyan-950/20 border-l-2 border-l-cyan-400" : "hover:bg-zinc-900/40"
                      }`}
                    >
                      <td className="py-4 px-4 font-medium text-white">
                        <div className="flex items-center gap-2.5 font-mono text-xs">
                          <div className="p-1.5 rounded border border-zinc-800 bg-zinc-900 text-cyan-400">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span>{item.type}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono">
                        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${item.sensitivityColor}`}>
                          {item.sensitivity}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-zinc-300">
                        {item.window}
                      </td>
                      <td className="py-4 px-4 font-mono text-cyan-300 font-semibold">
                        {item.threshold}
                      </td>
                      <td className="py-4 px-4 font-mono text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            item.key === 'infra' ? 'bg-red-400 animate-pulse' : item.key === 'dependency' ? 'bg-cyan-400' : 'bg-amber-400'
                          }`} />
                          <span>{item.rollbackAction}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-zinc-400 leading-relaxed font-sans text-xs hidden lg:table-cell">
                        {item.rationale}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Interactive Git Diff Inspector */}
        <div className="rounded-lg border border-zinc-800 bg-[#0a0a0d] p-6 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-zinc-800 gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-cyan-400" />
              <span className="text-white font-semibold">Live Diff Classification Tester</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">Selected: <span className="text-cyan-400 uppercase">{activeItem.type}</span></span>
            </div>

            {/* Quick selector tabs */}
            <div className="flex gap-1 bg-zinc-950 p-1 rounded border border-zinc-800">
              {matrixData.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setActiveType(m.key as any)}
                  className={`px-2.5 py-1 text-[11px] rounded transition-all font-mono ${
                    activeType === m.key
                      ? "bg-zinc-800 text-cyan-400 font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {m.type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4">
            {/* Diff View */}
            <div className="lg:col-span-7 bg-[#08080a] p-3.5 rounded border border-zinc-800 font-mono text-[11.5px] leading-relaxed overflow-x-auto text-zinc-300">
              <div className="text-[10px] text-zinc-500 mb-2 border-b border-zinc-800 pb-1">
                SAMPLE GIT DIFF PARSED BY CARF AST CLASSIFIER
              </div>
              {activeItem.diffExample.split("\n").map((line, idx) => (
                <div
                  key={idx}
                  className={`${
                    line.startsWith("+")
                      ? "bg-emerald-950/30 text-emerald-300"
                      : line.startsWith("-")
                      ? "bg-red-950/30 text-red-300"
                      : line.startsWith("@")
                      ? "text-cyan-400/80"
                      : "text-zinc-400"
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>

            {/* CARF Verdict */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div className="p-4 rounded border border-zinc-800 bg-zinc-950/80 space-y-3">
                <div className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
                  <span>CARF Evaluation Output</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${activeItem.sensitivityColor}`}>
                    {activeItem.sensitivity} Sensitivity
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-zinc-400">
                    <span>Monitoring Window:</span>
                    <span className="text-zinc-200 font-mono">{activeItem.window}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Error Ceiling:</span>
                    <span className="text-cyan-300 font-mono">{activeItem.threshold}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Action Policy:</span>
                    <span className="text-zinc-200 font-mono">{activeItem.rollbackAction}</span>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 font-sans border-t border-zinc-800 pt-2.5 leading-relaxed">
                  {activeItem.rationale}
                </p>
              </div>

              <div className="p-3 rounded border border-cyan-500/20 bg-cyan-950/10 text-[11px] text-cyan-300 flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                <span>CARF automatically updates its telemetry window as soon as this git commit lands.</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
