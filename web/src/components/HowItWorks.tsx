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
    output: "Tag: INFRASTRUCTURE · Complexity Score: High",
  },
  {
    id: "02",
    label: "Persist",
    name: "Vector Storage",
    icon: Activity,
    description:
      "Saves the computed change vector to Postgres, ready to be queried during progressive delivery.",
    output: "Stored: commit_sha 8f7a9d -> {type: infra, score: 0.8}",
  },
  {
    id: "03",
    label: "Evaluate",
    name: "Dynamic Threshold API",
    icon: Cpu,
    description:
      "Mid-canary, Argo Rollouts or Flagger queries CARF for the context-aware threshold for that specific commit.",
    output: "Response: { error_tolerance: 0.20%, window: '60s' }",
  },
  {
    id: "04",
    label: "Execute",
    name: "Delegated Rollback",
    icon: RotateCcw,
    description:
      "Argo Rollouts or Flagger evaluates real telemetry against CARF's dynamic threshold and executes the rollback.",
    output: "Argo Rollouts: Rollback executed (0.38% > 0.20%)",
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
            From commit classification to automated restoration, CARF acts as the decision layer for your progressive delivery pipeline.
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
