import { GitCommit, Activity, Cpu, CheckCircle2, ShieldAlert } from "lucide-react";

const nodes = {
  change: { x: 18.75, y: 15 },
  metrics: { x: 81.25, y: 15 },
  decision: { x: 50, y: 52 },
  outcome: { x: 50, y: 89 },
};

export function DecisionConvergenceDiagram() {
  return (
    <div className="relative w-full aspect-[640/280] font-['Inter',system-ui,sans-serif]">
      <svg viewBox="0 0 640 280" className="absolute inset-0 w-full h-full" aria-hidden>
        <line x1={nodes.change.x * 6.4} y1={nodes.change.y * 2.8} x2={nodes.decision.x * 6.4} y2={nodes.decision.y * 2.8} stroke="#d4d4d4" strokeWidth="1.5" strokeDasharray="4 4" />
        <line x1={nodes.metrics.x * 6.4} y1={nodes.metrics.y * 2.8} x2={nodes.decision.x * 6.4} y2={nodes.decision.y * 2.8} stroke="#d4d4d4" strokeWidth="1.5" strokeDasharray="4 4" />
        <line x1={nodes.decision.x * 6.4} y1={nodes.decision.y * 2.8} x2={nodes.outcome.x * 6.4} y2={nodes.outcome.y * 2.8} stroke="#bbb" strokeWidth="1.5" />
      </svg>

      {/* Change Classification */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
        style={{ left: `${nodes.change.x}%`, top: `${nodes.change.y}%` }}
      >
        <div className="w-11 h-11 rounded-full bg-white border border-[#ddd] flex items-center justify-center shadow-xs">
          <GitCommit className="w-5 h-5 text-[#111]" />
        </div>
        <div className="text-center">
          <div className="text-[12.5px] font-medium text-[#111]">What changed</div>
          <div className="text-[10px] font-mono text-[#999]">code · config · dep · infra</div>
        </div>
      </div>

      {/* Runtime Metrics */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
        style={{ left: `${nodes.metrics.x}%`, top: `${nodes.metrics.y}%` }}
      >
        <div className="w-11 h-11 rounded-full bg-white border border-[#ddd] flex items-center justify-center shadow-xs">
          <Activity className="w-5 h-5 text-[#111]" />
        </div>
        <div className="text-center">
          <div className="text-[12.5px] font-medium text-[#111]">How it behaves</div>
          <div className="text-[10px] font-mono text-[#999]">error rate · p95 · uptime</div>
        </div>
      </div>

      {/* Decision Engine */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
        style={{ left: `${nodes.decision.x}%`, top: `${nodes.decision.y}%` }}
      >
        <div className="w-14 h-14 rounded-full bg-[#111] border border-[#111] flex items-center justify-center">
          <Cpu className="w-6 h-6 text-white" />
        </div>
        <div className="text-[12.5px] font-semibold text-[#111]">Decision Engine</div>
      </div>

      {/* Outcome */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2"
        style={{ left: `${nodes.outcome.x}%`, top: `${nodes.outcome.y}%` }}
      >
        <div className="flex items-center gap-1.5 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
          <span className="text-[11px] font-mono font-medium text-[#166534]">continue</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#fef2f2] border border-[#fecaca] px-3 py-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-[#dc2626]" />
          <span className="text-[11px] font-mono font-medium text-[#991b1b]">rollback</span>
        </div>
      </div>
    </div>
  );
}
