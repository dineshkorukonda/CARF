import { Server, GitCommit, AlertOctagon } from "lucide-react";

export function ProblemStatement() {
  const problems = [
    {
      icon: Server,
      title: "Kubernetes gives you rollback mechanics, not rollback judgment",
      description:
        "Liveness and readiness probes restart crashing containers, but they cannot evaluate post-deploy HTTP 5xx spikes or latency anomalies against historical baselines.",
      impact: "Silent failures & degraded states slip past pod readiness gates.",
    },
    {
      icon: GitCommit,
      title: "CI/CD tracks that something changed, not how risky it was",
      description:
        "Pipelines push environment variables, third-party lockfile updates, and ingress terraforms through the exact same static verification gates as minor CSS tweaks.",
      impact: "High-risk infrastructure edits execute without elevated sensitivity.",
    },
    {
      icon: AlertOctagon,
      title: "Monitoring tools alert on fixed thresholds, not change-aware ones",
      description:
        "A 2% error rate spike after a non-critical feature deploy might be acceptable, but after an ingress TLS or database config change, it signifies complete service outage.",
      impact: "False positives trigger alert fatigue while real downtime goes un-reverted.",
    },
  ];

  return (
    <section id="problem" className="py-20 border-b border-zinc-800/60 bg-[#08080a]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 mb-3 uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            THE DEVOPS BLINDSPOT
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            Flat thresholds treat database schema migrations like CSS tweaks.
          </h2>
          <p className="mt-3 text-base text-zinc-400 leading-relaxed">
            Modern deployment tools automate code delivery, but leave engineers guessing during the critical post-deploy window.
          </p>
        </div>

        {/* 3-Column Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="group rounded-lg border border-zinc-800 bg-[#0d0d10] p-6 hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-zinc-800 bg-zinc-900/80 text-cyan-400 group-hover:border-cyan-500/30 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs text-zinc-600">0{idx + 1}</span>
                  </div>

                  <h3 className="text-base font-semibold text-zinc-100 font-sans leading-snug mb-3 group-hover:text-white transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800/60 font-mono text-[11px] text-zinc-500 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-amber-400/80" />
                  <span>{item.impact}</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
