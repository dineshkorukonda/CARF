"use client";

import { useState } from "react";
import { Code, HardDrive, Package, Settings, Zap } from "lucide-react";

export function ChangeTypeMatrix() {
  const [activeType, setActiveType] = useState<"code" | "config" | "dependency" | "infra">(
    "infra"
  );

  const matrixData = [
    {
      key: "code" as const,
      type: "Code",
      icon: Code,
      sensitivity: "Low",
      window: "15 minutes",
      threshold: "5.0%",
      rollbackAction: "Permissive Target",
      rationale:
        "Allows non-critical feature bugs to be hotfixed forward without disruptive automated rollbacks.",
      diffExample: `--- a/src/controllers/userController.ts
+++ b/src/controllers/userController.ts
- return res.status(200).json({ status: "ok" });
+ return res.status(200).json({ status: "success", version: "2.1" });`,
    },
    {
      key: "config" as const,
      type: "Config",
      icon: Settings,
      sensitivity: "Medium",
      window: "5 minutes",
      threshold: "2.5%",
      rollbackAction: "Strict Target",
      rationale:
        "Detects invalid environment variables, secret mismatches, or malformed feature flag JSON quickly.",
      diffExample: `--- a/config/production.env
+++ b/config/production.env
- DATABASE_POOL_MAX=20
+ DATABASE_POOL_MAX=2000`,
    },
    {
      key: "dependency" as const,
      type: "Dependency",
      icon: Package,
      sensitivity: "High",
      window: "3 minutes",
      threshold: "1.0%",
      rollbackAction: "Very Strict Target",
      rationale:
        "Reverts lockfile updates or major version upgrades that introduce silent memory leaks.",
      diffExample: `--- a/package.json
+++ b/package.json
- "express-session": "1.17.3"
+ "express-session": "2.0.0-rc1"`,
    },
    {
      key: "infra" as const,
      type: "Infrastructure",
      icon: HardDrive,
      sensitivity: "Strictest",
      window: "60 seconds",
      threshold: "0.2%",
      rollbackAction: "Zero Tolerance",
      rationale:
        "Zero-tolerance policy. Ingress, Terraform, Helm, or mesh failures revert within seconds.",
      diffExample: `--- a/k8s/ingress.yaml
+++ b/k8s/ingress.yaml
- path: /api/v1
+ path: /api/v2`,
    },
  ];

  const activeItem = matrixData.find((item) => item.key === activeType) || matrixData[3];

  return (
    <section id="sensitivity-matrix" className="py-24 sm:py-28 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 text-[#f56031] mb-4">
            <span className="font-mono text-xs uppercase tracking-[0.18em]">Sensitivity</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            Why change type matters.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-neutral-400 leading-relaxed">
            Treating every deployment with the same flat threshold causes false alarms on minor code
            updates while missing critical infrastructure outages.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-hatch border-b border-white/10 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                  <th className="py-3.5 px-4 font-medium">Change type</th>
                  <th className="py-3.5 px-4 font-medium">Sensitivity</th>
                  <th className="py-3.5 px-4 font-medium">Window</th>
                  <th className="py-3.5 px-4 font-medium">Threshold</th>
                  <th className="py-3.5 px-4 font-medium">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-white/[0.02]">
                {matrixData.map((item) => {
                  const Icon = item.icon;
                  const selected = activeType === item.key;
                  return (
                    <tr
                      key={item.key}
                      onClick={() => setActiveType(item.key)}
                      className={`cursor-pointer transition-colors ${
                        selected ? "bg-[#f56031]/10" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5 font-medium text-white">
                          <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-[#f56031]">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          {item.type}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-xs font-mono text-zinc-300">
                          {item.sensitivity}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-zinc-300">{item.window}</td>
                      <td className="py-4 px-4 font-mono text-[#f56031] font-semibold">
                        {item.threshold}
                      </td>
                      <td className="py-4 px-4 font-mono text-zinc-300">{item.rollbackAction}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 overflow-hidden">
          <div className="bg-hatch px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
            <span className="text-sm text-zinc-200">
              Live diff · <span className="text-[#f56031] uppercase">{activeItem.type}</span>
            </span>
            <div className="flex gap-1 rounded-full bg-black/40 p-1">
              {matrixData.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActiveType(m.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-mono transition ${
                    activeType === m.key
                      ? "bg-[#f56031] text-black font-semibold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {m.type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 bg-[#f4f4f0] text-black">
            <div className="lg:col-span-7 p-5 font-mono text-xs leading-relaxed overflow-x-auto">
              {activeItem.diffExample.split("\n").map((line, idx) => (
                <div
                  key={idx}
                  className={`${
                    line.startsWith("+")
                      ? "text-emerald-700"
                      : line.startsWith("-")
                        ? "text-red-600"
                        : "text-black/60"
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>
            <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-black/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Evaluation</span>
                <span className="rounded-full bg-[#f56031] px-2.5 py-1 text-[10px] font-semibold text-black">
                  {activeItem.sensitivity}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-black/50">
                  <span>Window</span>
                  <span className="font-mono text-black">{activeItem.window}</span>
                </div>
                <div className="flex justify-between text-black/50">
                  <span>Ceiling</span>
                  <span className="font-mono text-[#f56031]">{activeItem.threshold}</span>
                </div>
                <div className="flex justify-between text-black/50">
                  <span>Target</span>
                  <span className="font-mono text-black">{activeItem.rollbackAction}</span>
                </div>
              </div>
              <p className="text-sm text-black/55 leading-relaxed border-t border-black/10 pt-3">
                {activeItem.rationale}
              </p>
              <div className="flex items-start gap-2 rounded-2xl bg-black text-white px-3 py-2.5 text-xs">
                <Zap className="h-4 w-4 text-[#f56031] shrink-0 mt-0.5" />
                CARF generates dynamic bounds as soon as this commit lands.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
