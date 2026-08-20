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
    title: "The decision engine that knows what actually changed.",
    body: "Other monitors see an error spike. CARF sees the system change behind it: who touched the upstream ingress, whether it was a lockfile bump or a Helm rewrite. Every deploy starts grounded.",
    mock: {
      eyebrow: "DIFF CLASSIFIER",
      heading: "2 files · infrastructure",
      lines: [
        "k8s/ingress.yaml · path rewrite detected",
        "Sensitivity → STRICT",
        "Complexity → High",
        "Ready for persistence",
      ],
    },
  },
  {
    id: "persist",
    label: "Persist",
    icon: Layers3,
    title: "Change vectors stored for fast mid-canary retrieval.",
    body: "Every classified commit and its computed complexity score is persisted to Postgres. When Argo Rollouts or Flagger starts a deployment, CARF already knows exactly how risky the code change was.",
    mock: {
      eyebrow: "VECTOR STORAGE",
      heading: "Postgres entry",
      lines: [
        "commit: 8f7a9d",
        "type: infrastructure",
        "score: 0.85 (High)",
        "Status → PERSISTED",
      ],
    },
  },
  {
    id: "evaluate",
    label: "Evaluate",
    icon: FileStack,
    title: "Dynamic threshold webhooks for progressive delivery.",
    body: "Mid-canary, your delivery tool queries CARF. Instead of a hardcoded 5% error tolerance, CARF returns a dynamic threshold mathematically suited for that specific commit's risk profile.",
    mock: {
      eyebrow: "API RESPONSE",
      heading: "Threshold computed",
      lines: [
        "Commit vector retrieved",
        "Telemetry baseline injected",
        "Calculated Tolerance → 0.20%",
        "Action → Returned to Argo",
      ],
    },
  },
  {
    id: "delegate",
    label: "Delegate",
    icon: Workflow,
    title: "Integrates with Argo Rollouts and Flagger natively.",
    body: "CARF does not execute rollbacks. It acts as an intelligent sidecar for the production-grade delivery tools you already use, slotting into their existing AnalysisTemplate and webhook provider interfaces.",
    mock: {
      eyebrow: "DELEGATED",
      heading: "Argo Rollouts decides",
      lines: [
        "Argo receives 0.20% threshold",
        "Argo observes 0.38% error rate",
        "Argo executes rollout undo",
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
