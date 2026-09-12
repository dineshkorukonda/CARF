import { ArrowRight, ShieldCheck, GitBranch, Cpu } from "lucide-react";

export default function App() {
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
              href="https://dashboard.carf.indevs.in/login"
              className="font-['Inter',system-ui,sans-serif] text-[13px] font-medium text-[#666] hover:text-[#0a0a0a] transition-colors px-2 py-1"
            >
              Sign In
            </a>
            <a
              href="https://dashboard.carf.indevs.in/signup"
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

        {/* Hero Actions / Auth CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://dashboard.carf.indevs.in/dashboard"
            className="inline-flex items-center gap-2 bg-[#0a0a0a] hover:bg-[#262626] text-white font-['Inter',system-ui,sans-serif] text-[14px] font-medium px-5 py-2.5 rounded-[5px] transition-colors shadow-xs"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="https://dashboard.carf.indevs.in/signup"
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
