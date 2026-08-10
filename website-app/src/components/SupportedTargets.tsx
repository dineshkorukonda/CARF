import { Box, Cloud, GitPullRequest, Layers, Server, Terminal } from "lucide-react";

export function SupportedTargets() {
  const targets = [
    {
      name: "PM2",
      type: "Process Manager",
      icon: Terminal,
      method: "Zero-Downtime Reload",
      protocol: "Native CLI / IPC",
      badge: "Supported",
      description:
        "Restores previous process state via `pm2 reload` with zero lost HTTP connections.",
    },
    {
      name: "Docker Engine",
      type: "Container Runtime",
      icon: Box,
      method: "Container Re-tag & Swarm",
      protocol: "Docker Engine API",
      badge: "Supported",
      description:
        "Swaps active container image digest back to last verified immutable registry tag.",
    },
    {
      name: "Kubernetes",
      type: "Orchestrator",
      icon: Server,
      method: "Rollout Undo",
      protocol: "K8s API / Operator",
      badge: "Native Operator",
      description:
        "Executes `kubectl rollout undo deployment` and manages pod generation revisions.",
    },
    {
      name: "GitOps (ArgoCD / Flux)",
      type: "Continuous Delivery",
      icon: GitPullRequest,
      method: "Automated Revert Commit",
      protocol: "Webhook / Git Push",
      badge: "GitOps Native",
      description:
        "Commits a revert to your GitOps repository, triggering ArgoCD or Flux synchronization.",
    },
    {
      name: "Helm",
      type: "Package Manager",
      icon: Layers,
      method: "Helm Rollback",
      protocol: "Helm gRPC API",
      badge: "Supported",
      description:
        "Reverts Helm release to last healthy revision number with chart value preservation.",
    },
    {
      name: "AWS ECS",
      type: "Cloud Container Service",
      icon: Cloud,
      method: "Task Definition Revert",
      protocol: "AWS SDK / EventBridge",
      badge: "Supported",
      description:
        "Deploys previous AWS ECS Task Definition revision with target group health checks.",
    },
  ];

  return (
    <section id="targets" className="py-24 sm:py-28 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 text-[#f56031] mb-4">
            <span className="font-mono text-xs uppercase tracking-[0.18em]">Targets</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            Supported deployment targets
          </h2>
          <p className="mt-4 text-base sm:text-lg text-neutral-400 leading-relaxed">
            Plugs into the controllers you already run — with native handlers and sub-500ms
            response latency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
