import { Server, Terminal, Box, Layers, RefreshCw, GitPullRequest, Cloud, Cpu } from "lucide-react";

export function SupportedTargets() {
  const targets = [
    {
      name: "PM2",
      type: "Process Manager",
      icon: Terminal,
      method: "Zero-Downtime Reload",
      protocol: "Native CLI / IPC",
      badge: "Supported",
      description: "Restores previous process state via `pm2 reload` with zero lost HTTP connections.",
    },
    {
      name: "Docker Engine",
      type: "Container Runtime",
      icon: Box,
      method: "Container Re-tag & Swarm",
      protocol: "Docker Engine API",
      badge: "Supported",
      description: "Swaps active container image digest back to last verified immutable registry tag.",
    },
    {
      name: "Kubernetes",
      type: "Orchestrator",
      icon: Server,
      method: "Rollout Undo",
      protocol: "K8s API / Operator",
      badge: "Native Operator",
      description: "Executes `kubectl rollout undo deployment` and manages pod generation revisions.",
    },
    {
      name: "GitOps (ArgoCD / Flux)",
      type: "Continuous Delivery",
      icon: GitPullRequest,
      method: "Automated Revert Commit",
      protocol: "Webhook / Git Push",
      badge: "GitOps Native",
      description: "Commits a revert PR to your GitOps repository, triggering ArgoCD or Flux synchronization.",
    },
    {
      name: "Helm",
      type: "Package Manager",
      icon: Layers,
      method: "Helm Rollback",
      protocol: "Helm gRPC API",
      badge: "Supported",
      description: "Reverts Helm release to last healthy revision number with chart value preservation.",
    },
    {
      name: "AWS ECS",
      type: "Cloud Container Service",
      icon: Cloud,
      method: "Task Definition Revert",
      protocol: "AWS SDK / EventBridge",
      badge: "Supported",
      description: "Deploys previous AWS ECS Task Definition revision with target group health checks.",
    },
  ];

  return (
    <section id="targets" className="py-20 border-b border-zinc-800/60 bg-[#08080a]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 mb-3 uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            COMPATIBILITY & ECOSYSTEM
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            Supported deployment targets
          </h2>
          <p className="mt-3 text-base text-zinc-400 leading-relaxed">
            Plugs into your existing runtime controllers with native execution handlers and &lt; 500ms response latency.
          </p>
        </div>

        {/* Targets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {targets.map((target, idx) => {
            const Icon = target.icon;
            return (
              <div
                key={idx}
                className="group rounded-lg border border-zinc-800 bg-[#0c0c0f] p-5 hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded border border-zinc-800 bg-zinc-900 text-cyan-400 group-hover:border-cyan-500/30 transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white font-sans">
                          {target.name}
                        </h3>
                        <span className="text-[11px] font-mono text-zinc-500">{target.type}</span>
                      </div>
                    </div>

                    <span className="rounded border border-cyan-800/40 bg-cyan-950/40 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                      {target.badge}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed font-sans mb-4">
                    {target.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-800/60 font-mono text-[11px] text-zinc-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Rollback Method:</span>
                    <span className="text-zinc-300">{target.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Protocol:</span>
                    <span className="text-zinc-400">{target.protocol}</span>
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
