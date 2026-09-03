"use client";

import { useState } from "react";
import {
  Code2,
  Database,
  FileCode2,
  Layers,
  CheckCircle2,
  ShieldAlert,
  Settings2,
  Gauge,
  Sliders
} from "lucide-react";

export function InteractiveSystemFlow() {
  const [selectedVector, setSelectedVector] = useState<"code" | "config" | "dependency" | "infra" | "data">("code");
  const [simulatedErrorRate, setSimulatedErrorRate] = useState<number>(2.2);

  const vectors = {
    code: {
      title: "Application Code",
      icon: Code2,
      tier1: "Path: src/controllers/*.ts",
      tier2: "Tree-Sitter AST: 2 methods touched, cyclomatic depth +1",
      vectorWeights: { code: 0.8, code_complexity: 0.35, infra: 0.0, config: 0.0, dependency: 0.2 },
      baseWindow: "15 min",
      windowSec: 900,
      threshold: 5.0,
      color: "#2563eb", // blue
      bgColor: "#eff6ff",
      borderColor: "#bfdbfe",
      badge: "Permissive / Standard",
      description: "Business logic and API handler changes. Allows non-critical bugs to hotfix forward without false-alarm rollbacks."
    },
    config: {
      title: "Runtime Configuration",
      icon: Settings2,
      tier1: "Path: config/production.env",
      tier2: "Key Delta: DATABASE_POOL_MAX changed 20 -> 2000",
      vectorWeights: { code: 0.0, code_complexity: 0.0, infra: 0.0, config: 1.0, dependency: 0.0 },
      baseWindow: "5 min",
      windowSec: 300,
      threshold: 2.5,
      color: "#d97706", // amber
      bgColor: "#fffbeb",
      borderColor: "#fde68a",
      badge: "Medium Strictness",
      description: "Environment variables, feature flags, or pool sizes. Catches secret mismatches and malformed configs quickly."
    },
    dependency: {
      title: "Package Dependencies",
      icon: FileCode2,
      tier1: "Path: package-lock.json / Cargo.lock",
      tier2: "Dependency diff: express-session 1.17.3 -> 2.0.0-rc1",
      vectorWeights: { code: 0.0, code_complexity: 0.0, infra: 0.0, config: 0.0, dependency: 1.0 },
      baseWindow: "3 min",
      windowSec: 180,
      threshold: 1.0,
      color: "#7c3aed", // purple
      bgColor: "#f5f3ff",
      borderColor: "#ddd6fe",
      badge: "High Strictness",
      description: "Third-party version bumps. Catches unexpected transitive memory leaks and breaking API alterations."
    },
    infra: {
      title: "Infrastructure / Manifests",
      icon: Layers,
      tier1: "Path: k8s/ingress.yaml, Dockerfile",
      tier2: "Manifest Diff: Ingress route re-mapped /api/v1 -> /api/v2",
      vectorWeights: { code: 0.0, code_complexity: 0.0, infra: 1.0, config: 0.0, dependency: 0.0 },
      baseWindow: "60 sec",
      windowSec: 60,
      threshold: 0.2,
      color: "#dc2626", // red
      bgColor: "#fef2f2",
      borderColor: "#fecaca",
      badge: "Strictest / Zero Tolerance",
      description: "Routing, ingress, Docker, or Terraform changes. Zero-tolerance policy triggers automated rollback in seconds."
    },
    data: {
      title: "Database Migrations",
      icon: Database,
      tier1: "Path: prisma/migrations/**, db/migrate/**",
      tier2: "DDL Schema Diff: Added tenantId with NOT NULL constraint",
      vectorWeights: { code: 0.0, code_complexity: 0.0, infra: 0.0, config: 0.0, dependency: 0.0, data: 1.0 },
      baseWindow: "10 min",
      windowSec: 600,
      threshold: 1.0,
      color: "#0d9488", // teal
      bgColor: "#f0fdfa",
      borderColor: "#99f6e4",
      badge: "Strict / Data Integrity",
      description: "Database DDL and schema migrations. Strict 1.0% tolerance ceiling with 10-minute stabilization window."
    }
  };

  const active = vectors[selectedVector];
  const isViolated = simulatedErrorRate > active.threshold;

  return (
    <div className="my-10 border border-[#e5e5e5] rounded-[8px] bg-white shadow-xs overflow-hidden font-['Inter',system-ui,sans-serif]">
      
      {/* Header bar */}
      <div className="px-6 py-4 bg-[#fafafa] border-b border-[#eaeaea] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2563eb] animate-pulse" />
            <h3 className="text-[14px] font-semibold text-[#111] m-0">
              Interactive CARF Decision Pipeline Simulator
            </h3>
          </div>
          <p className="text-[12.5px] text-[#666] m-0 mt-0.5">
            Select a commit change type to inspect vector tiering, dynamic threshold decay, and canary decision logic.
          </p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] bg-white border border-[#ddd] px-2.5 py-1 rounded-[4px] text-[#444]">
          <Sliders className="w-3.5 h-3.5 text-[#2563eb]" />
          <span>Interactive Simulation</span>
        </div>
      </div>

      {/* Vector Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-[#eaeaea] bg-[#f8fafc]">
        {(Object.keys(vectors) as Array<keyof typeof vectors>).map((key) => {
          const item = vectors[key];
          const Icon = item.icon;
          const isSelected = selectedVector === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedVector(key)}
              className={`p-3.5 text-left transition-all border-b-2 flex flex-col gap-1 cursor-pointer ${
                isSelected
                  ? "bg-white border-[#111] shadow-xs"
                  : "border-transparent hover:bg-[#f1f5f9] text-[#64748b]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: isSelected ? item.color : "#64748b" }} />
                <span className={`text-[13px] font-medium ${isSelected ? "text-[#111]" : "text-[#475569]"}`}>
                  {item.title}
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#94a3b8]">
                Window: {item.baseWindow}
              </span>
            </button>
          );
        })}
      </div>

      {/* Interactive Main Stage */}
      <div className="p-6 space-y-6">
        
        {/* Pipeline Step Flow Diagram Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Step 1: Classification */}
          <div className="p-4 rounded-[6px] border border-[#e2e8f0] bg-[#f8fafc] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748b] font-semibold">
                Step 1 · Commit Classification
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor: active.bgColor, color: active.color, borderColor: active.borderColor }}>
                {active.badge}
              </span>
            </div>
            
            <div className="space-y-1.5 text-[12px] font-mono">
              <div className="p-2 rounded bg-white border border-[#cbd5e1] text-[#334155] truncate">
                <span className="text-[#94a3b8] font-sans">Tier 1 Path:</span> {active.tier1}
              </div>
              <div className="p-2 rounded bg-white border border-[#cbd5e1] text-[#334155] leading-normal">
                <span className="text-[#94a3b8] font-sans">Tier 2 AST:</span> {active.tier2}
              </div>
            </div>

            <div className="text-[11.5px] text-[#64748b] leading-relaxed font-sans">
              {active.description}
            </div>
          </div>

          {/* Step 2: Vector & Formula */}
          <div className="p-4 rounded-[6px] border border-[#e2e8f0] bg-[#f8fafc] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748b] font-semibold">
                Step 2 · Change Vector & Decay
              </span>
              <span className="text-[11px] font-mono font-medium text-[#0f172a]">
                Computed Ceiling
              </span>
            </div>

            {/* Vector Bars */}
            <div className="space-y-2 font-mono text-[11px]">
              {Object.entries(active.vectorWeights).map(([vKey, val]) => (
                <div key={vKey} className="space-y-1">
                  <div className="flex justify-between text-[#475569]">
                    <span>{vKey}</span>
                    <span>{(val * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#e2e8f0] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(val * 100, 5)}%`, backgroundColor: active.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2 rounded bg-white border border-[#e2e8f0] text-[11px] font-mono text-[#334155]">
              Threshold Ceiling: <span className="font-bold text-[#0f172a]">{active.threshold}%</span>
            </div>
          </div>

          {/* Step 3: Webhook Decision */}
          <div className="p-4 rounded-[6px] border border-[#e2e8f0] bg-[#f8fafc] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748b] font-semibold">
                Step 3 · Webhook Decision
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                isViolated ? "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]" : "bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]"
              }`}>
                {isViolated ? "ROLLBACK TRIGGERED" : "PASS / CONTINUE"}
              </span>
            </div>

            <div className="p-3 rounded bg-white border border-[#e2e8f0] space-y-2">
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-[#64748b]">Live Metric Reading:</span>
                <span className="font-mono font-bold text-[#0f172a]">{simulatedErrorRate.toFixed(1)}% 5xx</span>
              </div>
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-[#64748b]">Computed Limit:</span>
                <span className="font-mono font-bold" style={{ color: active.color }}>{active.threshold}% 5xx</span>
              </div>
              <div className="pt-2 border-t border-[#f1f5f9] text-[11px] text-[#64748b]">
                Target Webhook: <span className="font-mono text-[#0f172a]">Argo Rollouts / Flagger</span>
              </div>
            </div>

            <div className={`p-2.5 rounded text-[11.5px] leading-snug flex items-center gap-2 ${
              isViolated ? "bg-[#fef2f2] text-[#991b1b]" : "bg-[#f0fdf4] text-[#166534]"
            }`}>
              {isViolated ? (
                <>
                  <ShieldAlert className="w-4 h-4 shrink-0 text-[#dc2626]" />
                  <span>Threshold breached! CARF instructs Argo Rollouts to execute immediate rollback.</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16a34a]" />
                  <span>Metrics within calculated tolerance. Deployment proceeds smoothly.</span>
                </>
              )}
            </div>
          </div>

        </div>

        {/* Live Simulation Controls Slider */}
        <div className="p-4 rounded-[6px] bg-[#f8fafc] border border-[#e2e8f0] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-1/2 space-y-1">
            <div className="flex justify-between text-[12px]">
              <span className="font-medium text-[#0f172a] flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#2563eb]" />
                Simulated Post-Deploy HTTP 5xx Error Rate:
              </span>
              <span className="font-mono font-bold text-[#0f172a]">{simulatedErrorRate.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="6.0"
              step="0.1"
              value={simulatedErrorRate}
              onChange={(e) => setSimulatedErrorRate(parseFloat(e.target.value))}
              className="w-full accent-[#2563eb] cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-[#64748b]">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: active.color }} />
            <span>Active Limit: {active.threshold}% ({active.baseWindow} window)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
