"use client";

import { useState } from "react";
import { GitBranch, Activity, Cpu, RotateCcw, ChevronRight, CheckCircle2 } from "lucide-react";

export function HowItWorks() {
  const [selectedStep, setSelectedStep] = useState(0);

  const steps = [
    {
      id: "01",
      name: "Change classifier",
      label: "Classify",
      icon: GitBranch,
      description: "Tags deploys by change type (code, config, dependency, infra) from git diff & file ASTs.",
      details: {
        inputs: ["git diff HEAD~1", "lockfiles (package.json, Cargo.lock)", "Kubernetes manifests"],
        output: 'Tag: INFRASTRUCTURE | Sensitivity: STRICT | Window: 60s',
        mechanism: "Analyzes file paths, AST syntax trees, and lockfile modifications to assign change vector risk.",
      },
    },
    {
      id: "02",
      name: "Metrics collector",
      label: "Monitor",
      icon: Activity,
      description: "Watches real-time HTTP 5xx error rates, latency p99, and panic metrics post-deploy.",
      details: {
        inputs: ["Datadog APM", "Prometheus / OpenTelemetry", "eBPF Kernel Probes"],
        output: "Streaming Telemetry: HTTP 500 error_rate=0.38%, p99_latency=420ms",
        mechanism: "Connects to active observability pipelines to monitor post-deployment health during the active risk window.",
      },
    },
    {
      id: "03",
      name: "Decision engine",
      label: "Decide",
      icon: Cpu,
      description: "Applies per-project, per-change-type sensitivity thresholds and statistical confidence curves.",
      details: {
        inputs: [".carf.yml sensitivity ruleset", "Historical baseline error variance"],
        output: "DECISION: THRESHOLD_BREACHED (0.38% > 0.20% allowed for Infra)",
        mechanism: "Evaluates incoming telemetry against target thresholds. Code changes allow higher variance than core config.",
      },
    },
    {
      id: "04",
      name: "Rollback executor",
      label: "Execute",
      icon: RotateCcw,
      description: "Calls PM2, Docker, Kubernetes, or GitOps webhooks to restore last known stable version instantly.",
      details: {
        inputs: ["kubectl rollout undo", "PM2 process reload", "ArgoCD git commit revert"],
        output: "SUCCESS: Reverted to Revision 142 in 420ms. Slack alert dispatched.",
        mechanism: "Dispatches native rollback primitives to runtime controllers with zero manual intervention required.",
      },
    },
  ];

  return (
    <section id="how-it-works" className="py-20 border-b border-zinc-800/60 bg-[#060608]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 mb-3 uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            ARCHITECTURE & WORKFLOW
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            How CARF works: 4-step change-aware pipeline
          </h2>
          <p className="mt-3 text-base text-zinc-400 leading-relaxed">
            From commit classification to automated restoration, CARF executes in under 500 milliseconds.
          </p>
        </div>

        {/* 4-Step Horizontal Flow Diagram */}
        <div className="relative mb-12">
          
          {/* Step Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isSelected = selectedStep === index;
              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStep(index)}
                  className={`cursor-pointer rounded-lg border p-5 transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? "border-cyan-500/60 bg-zinc-900/90 shadow-lg shadow-cyan-950/20"
                      : "border-zinc-800 bg-[#0b0b0e] hover:border-zinc-700 hover:bg-zinc-900/40"
                  }`}
                >
                  <div>
                    {/* Header bar within step */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                        isSelected ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {step.id}
                      </span>

                      <div className={`p-1.5 rounded ${
                        isSelected ? "text-cyan-400" : "text-zinc-500"
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Step Title & Label */}
                    <div className="text-xs font-mono uppercase text-cyan-400 tracking-wider mb-1">
                      {step.label}
                    </div>
                    <h3 className="text-sm font-semibold text-white font-sans mb-2">
                      {step.name}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                      {step.description}
                    </p>
                  </div>

                  {/* Visual Indicator footer */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                    <span>Step {index + 1} of 4</span>
                    {index < 3 && <ChevronRight className="h-3.5 w-3.5 text-zinc-600 hidden md:block" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Step Technical Payload Drawer */}
        <div className="rounded-lg border border-zinc-800 bg-[#0a0a0d] p-6 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-zinc-800 text-zinc-300 gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span className="text-cyan-400 font-semibold">{steps[selectedStep].name}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">Step {steps[selectedStep].id} Execution Specification</span>
            </div>
            <span className="text-zinc-500 text-[11px]">Click steps above to inspect payloads</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 text-xs">
            <div>
              <div className="text-zinc-500 text-[11px] uppercase mb-1.5">Input Telemetry / Context</div>
              <ul className="space-y-1 text-zinc-300">
                {steps[selectedStep].details.inputs.map((inp, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>{inp}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-zinc-500 text-[11px] uppercase mb-1.5">Execution Mechanism</div>
              <p className="text-zinc-400 leading-relaxed font-sans text-xs">
                {steps[selectedStep].details.mechanism}
              </p>
            </div>

            <div>
              <div className="text-zinc-500 text-[11px] uppercase mb-1.5">Sample Output / Event</div>
              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-cyan-300 text-[11px] font-mono leading-relaxed">
                {steps[selectedStep].details.output}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
