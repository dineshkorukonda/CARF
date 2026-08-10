"use client";

import { useState } from "react";
import { GitBranch, Activity, Cpu, RotateCcw } from "lucide-react";

const steps = [
  {
    id: "01",
    label: "Classify",
    name: "Change classifier",
    icon: GitBranch,
    description:
      "Tags deploys by change type from git diffs and file ASTs — code, config, dependency, or infrastructure.",
    output: "Tag: INFRASTRUCTURE · Sensitivity: STRICT · Window: 60s",
  },
  {
    id: "02",
    label: "Monitor",
    name: "Metrics collector",
    icon: Activity,
    description:
      "Watches real-time HTTP 5xx, latency p99, and panic metrics during the adaptive post-deploy window.",
    output: "Telemetry: error_rate=0.38% · p99=420ms · window remaining 41s",
  },
  {
    id: "03",
    label: "Decide",
    name: "Decision engine",
    icon: Cpu,
    description:
      "Applies per-project, per-change-type sensitivity thresholds and confidence curves — not flat SLOs.",
    output: "DECISION: THRESHOLD_BREACHED (0.38% > 0.20%)",
  },
  {
    id: "04",
    label: "Execute",
    name: "Rollback executor",
    icon: RotateCcw,
    description:
      "Calls Kubernetes, PM2, Docker, or GitOps webhooks to restore the last known stable revision instantly.",
    output: "SUCCESS: Revision 142 restored in 420ms",
  },
];

export function HowItWorks() {
  const [selected, setSelected] = useState(0);

  return (
    <section id="how-it-works" className="py-24 sm:py-28 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-14">
          <div className="inline-flex items-center gap-2 text-[#f56031] mb-4">
            <span className="font-mono text-xs uppercase tracking-[0.18em]">Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            Four steps. One change-aware loop.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-neutral-400 leading-relaxed">
            From commit classification to automated restoration, CARF executes with contextual
            judgment — usually in under 500 milliseconds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const active = selected === index;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setSelected(index)}
                className={`text-left rounded-3xl border p-5 transition-all ${
                  active
                    ? "border-[#f56031]/50 bg-[#f56031]/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[11px] text-[#f56031]">{step.id}</span>
                  <Icon className={`h-4 w-4 ${active ? "text-[#f56031]" : "text-zinc-500"}`} />
                </div>
                <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#f56031] mb-1">
                  {step.label}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{step.name}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{step.description}</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-zinc-900/60 overflow-hidden">
          <div className="bg-hatch px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-zinc-300">
              {steps[selected].name} · payload
            </span>
            <span className="text-xs text-zinc-500">Step {selected + 1} of 4</span>
          </div>
          <div className="bg-[#f4f4f0] text-black px-5 py-5 sm:px-6 sm:py-6">
            <div className="font-mono text-sm sm:text-base text-[#f56031] mb-2">
              sample output
            </div>
            <p className="font-mono text-sm sm:text-base leading-relaxed">
              {steps[selected].output}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
