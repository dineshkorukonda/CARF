import { useState, useMemo } from "react";
import {
  ArrowRight,
  ShieldCheck,
  GitBranch,
  Cpu,
  Sliders,
  Globe,
  Server,
  Terminal,
  Sparkles,
} from "lucide-react";

interface ScenarioPreset {
  id: string;
  name: string;
  codeFiles: number;
  testFiles: number;
  infraFiles: number;
  configFiles: number;
  dbFiles: number;
  functionsModified: number;
  cyclomaticDelta: number;
  description: string;
}

const PRESETS: ScenarioPreset[] = [
  {
    id: "backend-refactor",
    name: "Core Algorithmic Refactor",
    codeFiles: 8,
    testFiles: 6,
    infraFiles: 0,
    configFiles: 0,
    dbFiles: 0,
    functionsModified: 12,
    cyclomaticDelta: 16,
    description: "Complex structural change with high cyclomatic complexity. Calibrated tolerance absorbs benign warmup.",
  },
  {
    id: "test-suite",
    name: "Test Suite Addition",
    codeFiles: 0,
    testFiles: 14,
    infraFiles: 0,
    configFiles: 0,
    dbFiles: 0,
    functionsModified: 0,
    cyclomaticDelta: 0,
    description: "14 test files updated with zero production code changes. Test discount applies (0.1x weight).",
  },
  {
    id: "config-tweak",
    name: "Config / Env Tweak",
    codeFiles: 0,
    testFiles: 0,
    infraFiles: 0,
    configFiles: 2,
    dbFiles: 0,
    functionsModified: 0,
    cyclomaticDelta: 0,
    description: "Minor configuration updates with minimal operational risk.",
  },
  {
    id: "db-migration",
    name: "Database Schema Migration",
    codeFiles: 2,
    testFiles: 2,
    infraFiles: 0,
    configFiles: 0,
    dbFiles: 3,
    functionsModified: 3,
    cyclomaticDelta: 4,
    description: "High-impact database migration requiring extended soak duration.",
  },
  {
    id: "k8s-rollout",
    name: "Infra / K8s Deployment",
    codeFiles: 0,
    testFiles: 0,
    infraFiles: 4,
    configFiles: 1,
    dbFiles: 0,
    functionsModified: 0,
    cyclomaticDelta: 0,
    description: "Kubernetes manifests and ingress routing changes.",
  },
];

export default function App() {
  const [activePreset, setActivePreset] = useState<string>("backend-refactor");
  const [codeFiles, setCodeFiles] = useState<number>(8);
  const [testFiles, setTestFiles] = useState<number>(6);
  const [infraFiles, setInfraFiles] = useState<number>(0);
  const [configFiles, setConfigFiles] = useState<number>(0);
  const [dbFiles, setDbFiles] = useState<number>(0);
  const [functionsModified, setFunctionsModified] = useState<number>(12);
  const [cyclomaticDelta, setCyclomaticDelta] = useState<number>(16);
  const [simulatedErrorRate, setSimulatedErrorRate] = useState<number>(1.2);

  const applyPreset = (preset: ScenarioPreset) => {
    setActivePreset(preset.id);
    setCodeFiles(preset.codeFiles);
    setTestFiles(preset.testFiles);
    setInfraFiles(preset.infraFiles);
    setConfigFiles(preset.configFiles);
    setDbFiles(preset.dbFiles);
    setFunctionsModified(preset.functionsModified);
    setCyclomaticDelta(preset.cyclomaticDelta);
  };

  const { riskMultiplier, dynamicBudget, soakWindowSeconds } = useMemo(() => {
    const codeWeight = codeFiles * 0.20;
    const testDiscount = Math.min(0.35, testFiles * 0.02);
    const infraWeight = infraFiles * 0.35;
    const configWeight = configFiles * 0.15;
    const dbWeight = dbFiles * 0.45;
    const astWeight = functionsModified * 0.04 + cyclomaticDelta * 0.035;

    const rawScore = 1.0 + codeWeight + infraWeight + configWeight + dbWeight + astWeight - testDiscount;
    const riskMultiplier = Math.max(0.5, Math.min(4.5, rawScore));
    const dynamicBudget = Math.min(4.0, Math.max(0.3, 0.5 * riskMultiplier + 0.3));
    const soakWindowSeconds = Math.min(450, Math.max(60, Math.round(60 + riskMultiplier * 45)));

    return { riskMultiplier, dynamicBudget, soakWindowSeconds };
  }, [codeFiles, testFiles, infraFiles, configFiles, dbFiles, functionsModified, cyclomaticDelta]);

  const staticTriggered = simulatedErrorRate > 1.0;
  const dynamicTriggered = simulatedErrorRate > dynamicBudget;

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#0a0a0a] flex flex-col justify-between selection:bg-[#0a0a0a] selection:text-white">
      {/* Top Minimal Navigation */}
      <header className="border-b border-[#eaeaea] bg-white sticky top-0 z-40">
        <div className="max-w-[1080px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="bg-[#0a0a0a] text-white px-2 py-0.5 text-[11px] font-mono font-semibold rounded-[3px] tracking-wider uppercase">
              CARF
            </span>
            <span className="font-['Inter',system-ui,sans-serif] text-[13px] font-semibold text-[#111] tracking-tight">
              Change-Aware Rollback Framework
            </span>
          </div>

          <nav className="flex items-center gap-4">
            <a
              href="https://carf.indevs.in/login"
              className="font-['Inter',system-ui,sans-serif] text-[13px] font-medium text-[#666] hover:text-[#0a0a0a] transition-colors px-2 py-1"
            >
              Sign In
            </a>
            <a
              href="https://carf.indevs.in/signup"
              className="font-['Inter',system-ui,sans-serif] text-[13px] font-medium bg-[#0a0a0a] hover:bg-[#262626] text-white px-3.5 py-1.5 rounded-[4px] transition-colors"
            >
              Get Started
            </a>
          </nav>
        </div>
      </header>

      {/* Main Single-Screen Hero & Showcase Content */}
      <main className="flex-1 max-w-[1080px] w-full mx-auto px-6 py-12 md:py-16 flex flex-col justify-center">
        {/* Badge & Headline */}
        <div className="max-w-[760px] mb-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#f5f5f5] border border-[#e5e5e5] text-[11px] font-mono text-[#555] mb-5 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Dynamic Canary Thresholds · AST-Calibrated Rollbacks
          </div>

          <h1 className="font-['Lora',Georgia,serif] text-[2.4rem] sm:text-[3.2rem] leading-[1.14] font-semibold tracking-[-0.03em] text-[#0a0a0a] mb-5">
            Dynamic, risk-calibrated error tolerances for progressive delivery.
          </h1>

          <p className="font-['Inter',system-ui,sans-serif] text-[16px] sm:text-[17px] leading-[1.65] text-[#555] max-w-[680px]">
            CARF replaces static rollback thresholds with real-time error tolerances calculated directly from commit diffs via deterministic file-path rules and Tree-sitter AST structural complexity analysis.
          </p>
        </div>

        {/* Three Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {/* Pillar 1 */}
          <div className="border border-[#eaeaea] bg-[#fafafa] rounded-[6px] p-5 flex flex-col justify-between hover:border-[#ccc] transition-colors">
            <div>
              <div className="w-8 h-8 rounded-[4px] bg-white border border-[#e5e5e5] flex items-center justify-center mb-3.5 text-[#111]">
                <GitBranch className="w-4 h-4" />
              </div>
              <h3 className="font-['Inter',system-ui,sans-serif] text-[14px] font-semibold text-[#111] mb-1.5">
                Tier 1 Path Rules
              </h3>
              <p className="font-['Inter',system-ui,sans-serif] text-[13px] leading-[1.6] text-[#666]">
                Deterministic classification of infrastructure manifests, config files, migrations, and docs to set baseline canary risk categories.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#f0f0f0] font-mono text-[11px] text-[#888]">
              Deterministic Pattern Matcher
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="border border-[#eaeaea] bg-[#fafafa] rounded-[6px] p-5 flex flex-col justify-between hover:border-[#ccc] transition-colors">
            <div>
              <div className="w-8 h-8 rounded-[4px] bg-white border border-[#e5e5e5] flex items-center justify-center mb-3.5 text-[#111]">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="font-['Inter',system-ui,sans-serif] text-[14px] font-semibold text-[#111] mb-1.5">
                Tier 2 Tree-Sitter AST
              </h3>
              <p className="font-['Inter',system-ui,sans-serif] text-[13px] leading-[1.6] text-[#666]">
                Structural syntax diffing computing exact cyclomatic changes, signature modifications, and control-flow impact across code changes.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#f0f0f0] font-mono text-[11px] text-[#888]">
              AST Complexity Analysis
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="border border-[#eaeaea] bg-[#fafafa] rounded-[6px] p-5 flex flex-col justify-between hover:border-[#ccc] transition-colors">
            <div>
              <div className="w-8 h-8 rounded-[4px] bg-white border border-[#e5e5e5] flex items-center justify-center mb-3.5 text-[#111]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="font-['Inter',system-ui,sans-serif] text-[14px] font-semibold text-[#111] mb-1.5">
                Real-Time Canary Tuning
              </h3>
              <p className="font-['Inter',system-ui,sans-serif] text-[13px] leading-[1.6] text-[#666]">
                Sidecar protocol feeding dynamic error budgets directly into Argo Rollouts, Flagger, or standalone deployment pipelines in real time.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#f0f0f0] font-mono text-[11px] text-[#888]">
              Zero False-Positive Rollbacks
            </div>
          </div>
        </div>

        {/* Interactive AST & Dynamic Threshold Playground */}
        <section className="mb-10 border border-[#eaeaea] bg-[#ffffff] rounded-[6px] p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#f0f0f0]">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#666] uppercase tracking-wider mb-1">
                <Sliders className="w-3.5 h-3.5 text-[#111]" />
                Interactive Calibration Playground
              </div>
              <h2 className="font-['Lora',Georgia,serif] text-[20px] font-semibold text-[#0a0a0a]">
                Simulate Tree-Sitter AST & Dynamic Canary Thresholds
              </h2>
            </div>
            <span className="text-[11px] text-[#666] font-mono bg-[#f5f5f5] px-2.5 py-1 rounded-[4px] border border-[#e8e8e8] self-start sm:self-auto">
              Real-Time Client Evaluation
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="mb-6">
            <span className="text-[12px] font-medium text-[#555] block mb-2 font-['Inter',system-ui,sans-serif]">
              Select Scenario Preset:
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => {
                const isSelected = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`text-[12px] font-medium px-3 py-1.5 rounded-[4px] border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-xs"
                        : "bg-[#fafafa] text-[#555] border-[#e0e0e0] hover:bg-[#f0f0f0] hover:text-[#111]"
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Controls (Left Column) */}
            <div className="lg:col-span-6 flex flex-col gap-4 bg-[#fafafa] border border-[#eaeaea] rounded-[6px] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-[#111] uppercase tracking-wider font-mono">
                  1. Change Vector Inputs
                </h3>
                <span className="text-[11px] text-[#888] font-mono">Tier 1 & Tier 2</span>
              </div>

              {/* File Counts */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-white border border-[#e8e8e8] rounded-[4px] p-2.5">
                  <label className="text-[11px] font-medium text-[#666] block mb-1">Code Files</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={codeFiles}
                    onChange={(e) => {
                      setCodeFiles(Math.max(0, parseInt(e.target.value) || 0));
                      setActivePreset("custom");
                    }}
                    className="w-full text-[13px] font-mono font-semibold text-[#111] bg-transparent border-b border-[#ccc] focus:outline-none focus:border-[#111]"
                  />
                </div>

                <div className="bg-white border border-[#e8e8e8] rounded-[4px] p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-[#666]">Test Files</label>
                    <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-100">0.1x</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={testFiles}
                    onChange={(e) => {
                      setTestFiles(Math.max(0, parseInt(e.target.value) || 0));
                      setActivePreset("custom");
                    }}
                    className="w-full text-[13px] font-mono font-semibold text-[#111] bg-transparent border-b border-[#ccc] focus:outline-none focus:border-[#111]"
                  />
                </div>

                <div className="bg-white border border-[#e8e8e8] rounded-[4px] p-2.5">
                  <label className="text-[11px] font-medium text-[#666] block mb-1">Infra / K8s</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={infraFiles}
                    onChange={(e) => {
                      setInfraFiles(Math.max(0, parseInt(e.target.value) || 0));
                      setActivePreset("custom");
                    }}
                    className="w-full text-[13px] font-mono font-semibold text-[#111] bg-transparent border-b border-[#ccc] focus:outline-none focus:border-[#111]"
                  />
                </div>

                <div className="bg-white border border-[#e8e8e8] rounded-[4px] p-2.5">
                  <label className="text-[11px] font-medium text-[#666] block mb-1">Config / Env</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={configFiles}
                    onChange={(e) => {
                      setConfigFiles(Math.max(0, parseInt(e.target.value) || 0));
                      setActivePreset("custom");
                    }}
                    className="w-full text-[13px] font-mono font-semibold text-[#111] bg-transparent border-b border-[#ccc] focus:outline-none focus:border-[#111]"
                  />
                </div>

                <div className="bg-white border border-[#e8e8e8] rounded-[4px] p-2.5">
                  <label className="text-[11px] font-medium text-[#666] block mb-1">DB Migrations</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={dbFiles}
                    onChange={(e) => {
                      setDbFiles(Math.max(0, parseInt(e.target.value) || 0));
                      setActivePreset("custom");
                    }}
                    className="w-full text-[13px] font-mono font-semibold text-[#111] bg-transparent border-b border-[#ccc] focus:outline-none focus:border-[#111]"
                  />
                </div>
              </div>

              {/* AST Tier 2 Churn Sliders */}
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="font-medium text-[#444]">AST Functions Modified:</span>
                    <span className="font-mono font-semibold text-[#111]">{functionsModified}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={functionsModified}
                    onChange={(e) => {
                      setFunctionsModified(parseInt(e.target.value));
                      setActivePreset("custom");
                    }}
                    className="w-full accent-[#0a0a0a] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="font-medium text-[#444]">Cyclomatic Complexity Delta (ΔCC):</span>
                    <span className="font-mono font-semibold text-[#111]">+{cyclomaticDelta}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={cyclomaticDelta}
                    onChange={(e) => {
                      setCyclomaticDelta(parseInt(e.target.value));
                      setActivePreset("custom");
                    }}
                    className="w-full accent-[#0a0a0a] cursor-pointer"
                  />
                </div>
              </div>

              {/* Scenario Error Rate Slider */}
              <div className="pt-3 border-t border-[#e8e8e8]">
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="font-medium text-[#333]">Simulated Transient Error Rate:</span>
                  <span className="font-mono font-bold text-amber-700">{simulatedErrorRate.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="4.0"
                  step="0.1"
                  value={simulatedErrorRate}
                  onChange={(e) => setSimulatedErrorRate(parseFloat(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="text-[11px] text-[#777] mt-1 font-mono">
                  Test canary safety verdicts under live spike conditions
                </div>
              </div>
            </div>

            {/* Evaluation Results & A/B Comparison (Right Column) */}
            <div className="lg:col-span-6 flex flex-col justify-between gap-4">
              {/* Output Metric Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="border border-[#e5e5e5] bg-white rounded-[6px] p-3 text-center">
                  <div className="text-[10px] font-mono text-[#777] uppercase tracking-wider">Dynamic Budget</div>
                  <div className="text-[18px] font-mono font-bold text-[#0a0a0a] mt-0.5">
                    {dynamicBudget.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-[#888]">calibrated cap</div>
                </div>

                <div className="border border-[#e5e5e5] bg-white rounded-[6px] p-3 text-center">
                  <div className="text-[10px] font-mono text-[#777] uppercase tracking-wider">Soak Window</div>
                  <div className="text-[18px] font-mono font-bold text-[#0a0a0a] mt-0.5">
                    {soakWindowSeconds}s
                  </div>
                  <div className="text-[10px] text-[#888]">observation time</div>
                </div>

                <div className="border border-[#e5e5e5] bg-white rounded-[6px] p-3 text-center">
                  <div className="text-[10px] font-mono text-[#777] uppercase tracking-wider">Risk Score</div>
                  <div className="text-[18px] font-mono font-bold text-[#0a0a0a] mt-0.5">
                    {riskMultiplier.toFixed(2)}x
                  </div>
                  <div className="text-[10px] text-[#888]">vector multiplier</div>
                </div>
              </div>

              {/* Side-by-Side A/B Verdict Comparison */}
              <div className="border border-[#eaeaea] rounded-[6px] p-3.5 bg-[#fafafa]">
                <div className="text-[11px] font-semibold text-[#111] uppercase tracking-wider font-mono mb-2.5">
                  A/B Rollback Decision Comparison
                </div>

                <div className="space-y-2.5">
                  {/* Traditional Static Threshold Verdict */}
                  <div
                    className={`p-2.5 rounded-[4px] border ${
                      staticTriggered
                        ? "bg-red-50 border-red-200 text-red-900"
                        : "bg-emerald-50 border-emerald-200 text-emerald-900"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span>Traditional Static Threshold (1.00% limit):</span>
                      <span className="font-mono uppercase tracking-wider text-[10px] font-bold">
                        {staticTriggered ? "🛑 False Positive Rollback" : "🟢 Passing"}
                      </span>
                    </div>
                    <p className="text-[11px] mt-1 opacity-90">
                      {staticTriggered
                        ? `Live error rate (${simulatedErrorRate.toFixed(1)}%) breaches rigid 1.00% cap. Rollout needlessly killed despite benign warmup.`
                        : `Live error rate (${simulatedErrorRate.toFixed(1)}%) is within static 1.00% threshold.`}
                    </p>
                  </div>

                  {/* CARF Dynamic AST-Calibrated Verdict */}
                  <div
                    className={`p-2.5 rounded-[4px] border ${
                      dynamicTriggered
                        ? "bg-red-50 border-red-200 text-red-900"
                        : "bg-emerald-50 border-emerald-200 text-emerald-900"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span>CARF AST-Calibrated ({dynamicBudget.toFixed(2)}% limit):</span>
                      <span className="font-mono uppercase tracking-wider text-[10px] font-bold">
                        {dynamicTriggered ? "🛑 Legitimate Rollback" : "🟢 Progressive Delivery Healthy"}
                      </span>
                    </div>
                    <p className="text-[11px] mt-1 opacity-90">
                      {dynamicTriggered
                        ? `Live error rate (${simulatedErrorRate.toFixed(1)}%) breaches calibrated risk tolerance (${dynamicBudget.toFixed(2)}%). Safe automated abort executed.`
                        : `Transient errors safely absorbed by structural risk budget (${dynamicBudget.toFixed(2)}%). Progressive canary rollout proceeds.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Change Vector Mathematical Decomposition */}
              <div className="bg-white border border-[#e8e8e8] rounded-[6px] p-2.5 text-[11px] font-mono text-[#555]">
                <div className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-1">
                  Change Vector Decomposition (T1 Path Rules + T2 AST)
                </div>
                <div className="bg-[#f7f7f7] p-2 rounded border border-[#eaeaea] text-[#111] overflow-x-auto text-[11px]">
                  {`V = [code:${codeFiles}, test:${testFiles} (0.1x), infra:${infraFiles}, cfg:${configFiles}, db:${dbFiles}, fns:${functionsModified}, ΔCC:+${cyclomaticDelta}]`}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Deployment Stacks & 1-Click Integrations */}
        <section className="mb-10 border border-[#eaeaea] bg-[#fafafa] rounded-[6px] p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#eaeaea]">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#666] uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#111]" />
                1-Click Platform Presets
              </div>
              <h2 className="font-['Lora',Georgia,serif] text-[20px] font-semibold text-[#0a0a0a]">
                Zero-Friction Protection for Modern Clouds
              </h2>
            </div>
            <span className="text-[11px] text-[#666] font-mono bg-[#ffffff] px-2.5 py-1 rounded-[4px] border border-[#e0e0e0] self-start sm:self-auto">
              Auto Stack Recognition
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Vercel Card */}
            <div className="border border-[#e5e5e5] bg-white rounded-[6px] p-4 flex flex-col justify-between shadow-2xs hover:border-[#bbb] transition-all">
              <div>
                <div className="flex items-center gap-2 mb-2 font-semibold text-[#111] text-[14px]">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>Vercel (Next.js)</span>
                </div>
                <p className="text-[12px] text-[#666] leading-[1.6]">
                  Advisory Mode generates real-time PR risk badges and preview soak checks without blocking production builds.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#f0f0f0] font-mono text-[10px] text-blue-700 bg-blue-50/70 p-2 rounded">
                curl -s https://carf.indevs.in/v1/threshold?commit=$SHA
              </div>
            </div>

            {/* Render Card */}
            <div className="border border-[#e5e5e5] bg-white rounded-[6px] p-4 flex flex-col justify-between shadow-2xs hover:border-[#bbb] transition-all">
              <div>
                <div className="flex items-center gap-2 mb-2 font-semibold text-[#111] text-[14px]">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span>Render.com</span>
                </div>
                <p className="text-[12px] text-[#666] leading-[1.6]">
                  Deploy Hook triggers and health endpoint polling for calculated soak duration before release sign-off.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#f0f0f0] font-mono text-[10px] text-indigo-700 bg-indigo-50/70 p-2 rounded">
                Deploy Hook + /healthz soak window
              </div>
            </div>

            {/* PM2 Card */}
            <div className="border border-[#e5e5e5] bg-white rounded-[6px] p-4 flex flex-col justify-between shadow-2xs hover:border-[#bbb] transition-all">
              <div>
                <div className="flex items-center gap-2 mb-2 font-semibold text-[#111] text-[14px]">
                  <Terminal className="w-4 h-4 text-emerald-600" />
                  <span>PM2 (VPS / Node)</span>
                </div>
                <p className="text-[12px] text-[#666] leading-[1.6]">
                  Capistrano release layout (/var/www/releases) with zero-downtime cluster reloads and instant symlink rollbacks.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#f0f0f0] font-mono text-[10px] text-emerald-700 bg-emerald-50/70 p-2 rounded">
                ln -sfn releases/prev current && pm2 reload
              </div>
            </div>
          </div>
        </section>

        {/* Hero Actions / Auth CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://carf.indevs.in/dashboard"
            className="inline-flex items-center gap-2 bg-[#0a0a0a] hover:bg-[#262626] text-white font-['Inter',system-ui,sans-serif] text-[14px] font-medium px-5 py-2.5 rounded-[5px] transition-colors shadow-xs"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="https://carf.indevs.in/signup"
            className="inline-flex items-center bg-white hover:bg-[#f7f7f7] border border-[#e0e0e0] text-[#111] font-['Inter',system-ui,sans-serif] text-[14px] font-medium px-4 py-2.5 rounded-[5px] transition-colors"
          >
            Create Account
          </a>
        </div>
      </main>

      {/* Clean Viewport Bottom Bar */}
      <footer className="border-t border-[#eaeaea] bg-[#ffffff] py-4">
        <div className="max-w-[1080px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] font-['Inter',system-ui,sans-serif] text-[#777]">
          <div>
            <span className="font-semibold text-[#111]">CARF</span> — Change-Aware Rollback Framework
          </div>
          <div className="font-mono text-[11px] text-[#999]">
            Dynamic Release Calibration
          </div>
        </div>
      </footer>
    </div>
  );
}
