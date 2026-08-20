import { Activity, LayoutDashboard, Server, Layers } from "lucide-react";

export function SupportedTargets() {
  const targets = [
    {
      name: "Argo Rollouts",
      type: "Progressive Delivery",
      icon: Server,
      method: "AnalysisTemplate Webhook",
      protocol: "HTTP API",
      badge: "Native Integration",
      description:
        "CARF responds to Argo Rollouts mid-canary to provide the dynamic threshold for the commit.",
    },
    {
      name: "Flagger",
      type: "Progressive Delivery",
      icon: Layers,
      method: "Webhook Metric",
      protocol: "HTTP API",
      badge: "Native Integration",
      description:
        "Plugs into Flagger's webhook metric provider to drive rollback decisions intelligently.",
    },
    {
      name: "Prometheus",
      type: "Metrics Backend",
      icon: Activity,
      method: "PromQL client",
      protocol: "HTTP API",
      badge: "Supported",
      description:
        "CARF queries baseline health data from Prometheus to optionally adjust its threshold output.",
    },
    {
      name: "Datadog",
      type: "Metrics Backend",
      icon: LayoutDashboard,
      method: "API Client",
      protocol: "HTTP API",
      badge: "Supported",
      description:
        "Integrates with Datadog telemetry to inform dynamic threshold scoring.",
    }
  ];

  return (
    <section id="targets" className="py-24 sm:py-28 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 text-[#f56031] mb-4">
            <span className="font-mono text-xs uppercase tracking-[0.18em]">Integrations</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            Supported integrations
          </h2>
          <p className="mt-4 text-base sm:text-lg text-neutral-400 leading-relaxed">
            Plugs into the progressive delivery tools you already run — providing dynamic thresholds without replacing them.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {targets.map((target) => {
            const Icon = target.icon;
            return (
              <div
                key={target.name}
                className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5 hover:border-[#f56031]/40 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f56031]/10 text-[#f56031] border border-[#f56031]/20">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{target.name}</h3>
                      <span className="text-[11px] font-mono text-zinc-500">{target.type}</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-black">
                    {target.badge}
                  </span>
                </div>

                <p className="text-sm text-neutral-400 leading-relaxed mb-4">
                  {target.description}
                </p>

                <div className="pt-3 border-t border-white/10 font-mono text-[11px] text-zinc-500 space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <span>Method</span>
                    <span className="text-zinc-300 text-right">{target.method}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Protocol</span>
                    <span className="text-zinc-400 text-right">{target.protocol}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
