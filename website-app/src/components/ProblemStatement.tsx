export function ProblemStatement() {
  return (
    <section id="problem" className="relative border-t border-white/10">
      {/* Product preview strip */}
      <div className="bg-hatch px-4 sm:px-8 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl rounded-[28px] bg-[#f4f4f0] text-black shadow-2xl shadow-black/50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/10 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-sm font-semibold">CARF</span>
              <div className="ml-2 hidden sm:flex items-center gap-1 rounded-full bg-black/5 p-1 text-xs">
                <span className="rounded-full px-3 py-1 text-black/50">Projects</span>
                <span className="rounded-full bg-white px-3 py-1 font-medium shadow-sm">
                  Decisions
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-black/40 font-mono">checkout-api</span>
              <span className="h-7 w-7 rounded-full bg-[#f56031] text-white text-sm font-bold grid place-items-center">
                +
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[320px]">
            <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-black/10 p-4 space-y-3 bg-[#ecece7]">
              <div className="text-[11px] font-semibold tracking-wider text-black/40 uppercase">
                Live traces
              </div>
              {[
                { title: "Ingress path rewrite", status: "Rolling back", hot: true },
                { title: "Pool max bump", status: "Monitoring", hot: false },
                { title: "express-session major", status: "Idle", hot: false },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`rounded-2xl border px-3.5 py-3 ${
                    item.hot
                      ? "border-[#f56031]/40 bg-[#f56031]/10"
                      : "border-black/5 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] ${
                        item.hot ? "text-[#f56031]" : "text-black/40"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          item.hot ? "bg-[#f56031]" : "bg-black/30"
                        }`}
                      />
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </aside>

            <div className="lg:col-span-8 p-5 sm:p-6 space-y-4">
              <div className="rounded-2xl border border-[#f56031]/50 bg-white p-4 sm:p-5">
                <div className="font-mono text-xs text-[#f56031] mb-3">
                  CARF Decision Engine · INFRASTRUCTURE
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2">
                  Threshold breached — reverting revision 142
                </h3>
                <p className="text-sm text-black/55 leading-relaxed max-w-xl">
                  HTTP 5xx spiked to 0.38% inside a 60s window. Allowed ceiling for infrastructure
                  changes is 0.20%. Rollback latency: 420ms.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs font-mono">
                  <div className="rounded-xl bg-black/[0.04] px-3 py-2">
                    <div className="text-black/40">Vector</div>
                    <div className="font-semibold">INFRA</div>
                  </div>
                  <div className="rounded-xl bg-black/[0.04] px-3 py-2">
                    <div className="text-black/40">Window</div>
                    <div className="font-semibold">60s</div>
                  </div>
                  <div className="rounded-xl bg-black/[0.04] px-3 py-2">
                    <div className="text-black/40">Action</div>
                    <div className="font-semibold text-[#f56031]">UNDO</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-black text-white font-mono text-xs sm:text-sm px-4 py-3">
                <span className="text-[#f56031]">›</span> kubectl rollout undo deployment/checkout-api
                -n production
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Narrative prose */}
      <div className="mx-auto max-w-3xl px-6 sm:px-8 py-24 sm:py-32">
        <div className="space-y-8 text-2xl sm:text-[1.75rem] leading-[1.45] font-semibold tracking-tight">
          <p className="text-white">
            CI/CD solved the shipping problem. Code lands faster, manifests update constantly,
            services multiply.
          </p>
          <p className="text-neutral-500">
            But something else happened. Flat error thresholds treated database migrations like CSS
            tweaks. Monitoring fired the same alarm for both — or missed the outage entirely.
          </p>
          <p className="text-neutral-500">
            The judgment that would fix this wasn&apos;t missing. It lived in runbooks nobody opened
            during the incident, in the heads of the three people who last touched that ingress.
          </p>
          <p className="text-white">
            That&apos;s not a tooling gap. It&apos;s a context gap. And static SLOs don&apos;t solve
            it — they go stale while the blast radius keeps moving.
          </p>
          <p className="text-white">
            CARF is different. It reads what changed before it watches what fails. Code gets room to
            breathe. Infrastructure gets zero tolerance. Your rollbacks don&apos;t guess. They know.
          </p>
        </div>
      </div>
    </section>
  );
}
