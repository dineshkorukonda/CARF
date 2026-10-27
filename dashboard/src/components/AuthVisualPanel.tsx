import React from "react";
import { Activity, GitBranch, ShieldCheck, Terminal, Layers, Box, Server, Radio, Sliders } from "lucide-react";

/**
 * Decorative right-hand panel for auth pages showcasing CARF's automated rollback cockpit,
 * AST diff classification, and live dynamic error rate telemetry.
 */
export function AuthVisualPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between p-12 border-l border-border/40 select-none">
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Radial Glow */}
      <div
        className="absolute top-1/3 right-1/4 w-[450px] h-[350px] -z-0 opacity-40 blur-[100px] pointer-events-none rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, rgba(16,185,129,0.15) 70%, transparent 100%)",
        }}
      />

      {/* Top Meta Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-sm bg-emerald-500" />
          <span className="font-mono text-xs uppercase tracking-wider text-slate-300 font-semibold">
            Automated Guard Engine
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-500 px-2 py-0.5 rounded border border-slate-800 bg-slate-900/60">
          v1.4.0-stable
        </span>
      </div>

      {/* Center Simulated Cockpit Card */}
      <div className="relative z-10 my-auto max-w-md w-full mx-auto">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 shadow-2xl space-y-5">
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Activity className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Active Deployment Soak</p>
                <p className="text-[10px] font-mono text-slate-400">target: production-api</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              HEALTHY &bull; 142s / 180s
            </span>
          </div>

          {/* AST Diff Details */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <GitBranch className="size-3 text-indigo-400" />
                <span>b7a89f3 &rarr; main</span>
              </span>
              <span className="text-emerald-400 font-medium">AST: Code (TS)</span>
            </div>
            <p className="text-slate-200 text-xs truncate">feat(api): optimize connection pooling &amp; queries</p>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/50 text-[10px] text-slate-400">
              <div>
                <span>Syntactic Churn: </span>
                <span className="text-slate-200">+38 nodes</span>
              </div>
              <div className="text-right">
                <span>Blast Radius: </span>
                <span className="text-slate-200">12.4 / 100</span>
              </div>
            </div>
          </div>

          {/* Dynamic Error Ceiling Visual Telemetry */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <Sliders className="size-3 text-amber-400" />
                <span>Dynamic Ceiling: 0.024 (2.4%)</span>
              </span>
              <span className="text-emerald-400 font-semibold">Observed: 0.002%</span>
            </div>

            {/* SVG Telemetry Curve */}
            <div className="relative h-20 w-full pt-1">
              <svg viewBox="0 0 340 70" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Calibrated Ceiling Line (Dashed Amber) */}
                <line
                  x1="0"
                  y1="18"
                  x2="340"
                  y2="18"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.8"
                />

                {/* Shaded Area under error curve */}
                <path
                  d="M0,58 Q40,54 80,56 T160,52 T240,55 T340,57 L340,70 L0,70 Z"
                  fill="url(#areaGradient)"
                />

                {/* Real-time Error Rate Curve (Emerald) */}
                <path
                  d="M0,58 Q40,54 80,56 T160,52 T240,55 T340,57"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Real-time sample node */}
                <circle cx="280" cy="55" r="3.5" fill="#10b981" />
                <circle cx="280" cy="55" r="7" fill="#10b981" opacity="0.3" />
              </svg>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>0s (Startup Grace)</span>
              <span className="text-amber-400/90">Ceiling Threshold</span>
              <span>180s (Promote)</span>
            </div>
          </div>

          {/* Rollback Strategy Readiness Footer */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span>Zero-Downtime Rollback Armed</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">Recovery &lt; 850ms</span>
          </div>
        </div>

        {/* Runtime compatibility tags */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {[
            { name: "Kubernetes", icon: Box },
            { name: "Docker", icon: Layers },
            { name: "systemd", icon: Server },
            { name: "PM2", icon: Terminal },
            { name: "Prometheus", icon: Radio },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.name}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-slate-800 bg-slate-900/60 text-[11px] font-mono text-slate-400"
              >
                <Icon className="size-3 text-slate-400" />
                <span>{item.name}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Bottom Quote & Guarantee */}
      <div className="relative z-10 max-w-md mx-auto text-center space-y-1">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          &ldquo;Eliminate 3 AM rollback panics. Deploy with confidence knowing CARF guards every release with commit-aware error thresholds.&rdquo;
        </p>
        <p className="text-[10px] font-mono text-slate-500">
          Automated deployment resilience for modern engineering teams.
        </p>
      </div>
    </div>
  );
}
