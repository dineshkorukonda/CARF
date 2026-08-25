const PHASES = [
  {
    phase: "Phase 1",
    title: "Classification Engine",
    desc: "Two-tier commit classifier producing a normalized change vector",
    status: "Complete",
  },
  {
    phase: "Phase 2",
    title: "Threshold Engine + Persistence",
    desc: "Change vector → dynamic threshold, Postgres storage",
    status: "Complete",
  },
  {
    phase: "Phase 3",
    title: "Integrations + Evaluation",
    desc: "Augment/Standalone adapters, synthetic evaluation harness",
    status: "Complete",
    detail: "kubectl + Docker Compose adapters shipped · PM2 + GitOps adapters and the telemetry API still planned",
  },
  {
    phase: "—",
    title: ".carf.yml Configuration",
    desc: "Optional repo-root config for classification rules + threshold tuning",
    status: "Complete",
    detail: "mode/adapter fields are schema-validated but not yet wired to a composition root",
  },
];

/**
 * CARF's own build progress (Phase 1/2/3 + .carf.yml). Shared by the landing page and
 * /integrate so the two never drift apart from hand-editing two copies.
 */
export function ProjectStatus() {
  return (
    <div className="rounded-[6px] border border-[#e5e5e5] bg-[#fafafa] p-5 font-['Inter',system-ui,sans-serif]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#111] m-0">
          Project Status
        </h2>
        <a
          href="https://github.com/dineshkorukonda/CARF/milestones"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12.5px] font-medium text-[#111] underline underline-offset-2 hover:opacity-60 whitespace-nowrap"
        >
          Follow progress on GitHub →
        </a>
      </div>
      <p className="text-[13.5px] leading-[1.6] text-[#555] mb-4">
        CARF&apos;s core pipeline is fully implemented in <code className="font-mono text-[12px] bg-[#eee] px-1 rounded">core-api/</code>: the two-tier classifier (path/manifest rules + Tree-sitter AST complexity), the dynamic threshold/decay engine, Postgres persistence, both Augment (webhook API) and Standalone (health-check loop + rollback adapters) modes, and the synthetic evaluation harness that proves H1. An optional <code className="font-mono text-[12px] bg-[#eee] px-1 rounded">.carf.yml</code> now lets you tune classification and threshold behavior without touching source. Remaining work is additive: more rollback adapters (PM2, GitOps), the telemetry API, and wiring <code className="font-mono text-[12px] bg-[#eee] px-1 rounded">.carf.yml</code>&apos;s mode/adapter fields into a real composition root.
      </p>
      <div className="space-y-2">
        {PHASES.map((p) => (
          <div key={p.title} className="flex items-start justify-between gap-3 bg-white border border-[#eaeaea] rounded-[4px] px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-[#888] shrink-0">{p.phase}</span>
                <span className="text-[13px] font-medium text-[#111]">{p.title}</span>
              </div>
              <div className="text-[12px] text-[#888] mt-0.5">{p.desc}</div>
              {p.detail && <div className="text-[11px] text-[#a16207] mt-1">{p.detail}</div>}
            </div>
            <span
              className={`shrink-0 text-[10.5px] font-mono font-medium uppercase tracking-wide px-2 py-0.5 rounded mt-0.5 ${
                p.status === "In progress"
                  ? "text-[#a16207] bg-[#fef9e7] border border-[#fde68a]"
                  : p.status === "Complete"
                    ? "text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0]"
                    : "text-[#666] bg-[#f4f4f4] border border-[#e5e5e5]"
              }`}
            >
              {p.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
