import {
  BrainCircuit,
  Layers3,
  FileStack,
  Workflow,
} from "lucide-react";

const features = [
  {
    id: "classify",
    label: "Classify",
    icon: BrainCircuit,
    title: "The rollback engine that knows what actually changed.",
    body: "Other monitors see an error spike. CARF sees the system change behind it: who touched the upstream ingress, whether it was a lockfile bump or a Helm rewrite, and how strict the window should be. Every deploy starts grounded.",
    mock: {
      eyebrow: "DIFF CLASSIFIER",
      heading: "2 files · infrastructure",
      lines: [
        "k8s/ingress.yaml · path rewrite detected",
        "Sensitivity → STRICT",
        "Window → 60 seconds",
        "Ceiling → 0.20% HTTP 5xx",
      ],
    },
  },
  {
    id: "monitor",
    label: "Monitor",
    icon: Layers3,
    title: "The observation window your deploy actually deserves.",
    body: "Code changes get room to breathe. Config and dependency bumps tighten the loop. Infrastructure gets the shortest fuse. When an engineer ships, the context doesn't disappear into a flat dashboard — it's scored against the right threshold.",
    mock: {
      eyebrow: "LIVE WINDOW",
      heading: "Monitoring · 41s remaining",
      lines: [
        "Baseline error_rate 0.04%",
        "Current error_rate 0.38%",
        "p99 latency 420ms",
        "Status → BREACH LIKELY",
      ],
    },
  },
  {
    id: "decide",
    label: "Decide",
    icon: FileStack,
    title: "Living decision logs, written as the work happens.",
    body: "Every evaluation produces durable knowledge: what changed, which threshold applied, why the action fired. No more asking on-call to reconstruct judgment after the fact — it happens as the deploy happens.",
    mock: {
      eyebrow: "DECISION TRACE",
      heading: "Rollback authorized",
      lines: [
        "Vector INFRA crossed 0.20%",
        "Confidence 0.97",
        "Executor → kubernetes",
        "Slack + PagerDuty notified",
      ],
    },
  },
  {
    id: "execute",
    label: "Execute",
    icon: Workflow,
    title: "Works with Kubernetes, PM2, Docker, GitOps. Knows your runtime.",
    body: "CARF is a harness for the controller you already run. Switch between kubectl undo, PM2 reload, container swap, or ArgoCD revert without losing the decision context. Stay runtime-independent while judgment compounds.",
    mock: {
      eyebrow: "EXECUTOR",
      heading: "Revision 142 restored",
      lines: [
        "kubectl rollout undo …",
        "Latency 420ms",
        "Health gates green",
        "Session closed",
      ],
    },
  },
];

export function FeatureSections() {
  return (
    <section id="features" className="border-t border-white/10">
      {features.map((feature, index) => {
        const Icon = feature.icon;
        const reverse = index % 2 === 1;
        return (
          <div
            key={feature.id}
            className="border-b border-white/10 py-20 sm:py-28"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div
                className={`grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center ${
                  reverse ? "" : ""
                }`}
              >
                <div className={`lg:col-span-5 ${reverse ? "lg:order-2" : ""}`}>
                  <div className="inline-flex items-center gap-2 text-[#f56031] mb-5">
                    <Icon className="h-4 w-4" />
                    <span className="font-mono text-xs uppercase tracking-[0.18em]">
                      {feature.label}
                    </span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-[1.15] mb-5">
                    {feature.title}
                  </h2>
                  <p className="text-base sm:text-lg text-neutral-400 leading-relaxed">
                    {feature.body}
                  </p>
                </div>

                <div className={`lg:col-span-7 ${reverse ? "lg:order-1" : ""}`}>
                  <div className="rounded-[28px] bg-hatch p-3 sm:p-4">
                    <div className="rounded-[22px] bg-[#f4f4f0] text-black overflow-hidden shadow-xl shadow-black/30">
                      <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                        <span className="ml-2 text-xs font-medium text-black/50">
                          {feature.mock.eyebrow}
                        </span>
                      </div>
                      <div className="p-5 sm:p-6">
                        <h3 className="text-xl font-semibold mb-4">{feature.mock.heading}</h3>
                        <ul className="space-y-2.5">
                          {feature.mock.lines.map((line) => (
                            <li
                              key={line}
                              className="flex items-start gap-2 font-mono text-sm text-black/70"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#f56031] shrink-0" />
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
