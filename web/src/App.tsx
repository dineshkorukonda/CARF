import { useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  GitBranch,
  Cpu,
  Server,
  Terminal,
  Sparkles,
  Copy,
  Check,
  Zap,
} from "lucide-react";
import { SiteChrome } from "./SiteChrome";

export default function App() {
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const installCmd = "curl -fsSL https://carf.indevs.in/install.sh | bash -s -- --token=<YOUR_INSTALL_TOKEN>";

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(installCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <SiteChrome>
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
                Sidecar protocol feeding dynamic error-rate thresholds directly into standalone or CI deployment pipelines in real time.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#f0f0f0] font-mono text-[11px] text-[#888]">
              Zero False-Positive Rollbacks
            </div>
          </div>
        </div>

        {/* Host Agent & Background Service Section */}
        <section className="mb-10 border border-[#eaeaea] bg-[#ffffff] rounded-[6px] p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#f0f0f0]">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#666] uppercase tracking-wider mb-1">
                <Terminal className="w-3.5 h-3.5 text-[#111]" />
                One-Command Host Installation
              </div>
              <h2 className="font-['Lora',Georgia,serif] text-[20px] font-semibold text-[#0a0a0a]">
                Deploy the CARF Agent to Your Server
              </h2>
            </div>
            <span className="text-[11px] text-emerald-700 font-mono bg-emerald-50 px-2.5 py-1 rounded-[4px] border border-emerald-200 self-start sm:self-auto flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              PM2 &amp; systemd Supported
            </span>
          </div>

          <p className="text-[13px] text-[#555] mb-4 font-['Inter',system-ui,sans-serif]">
            Install the lightweight agent on your VPS or host in seconds. It runs quietly in the background as a PM2 process or systemd service, streams health telemetry every 60s, and executes instant symlink or git rollbacks.
          </p>

          {/* Copyable Curl Installer Box */}
          <div className="relative mb-6">
            <pre className="rounded-[5px] border border-[#e5e5e5] bg-[#0f172a] p-4 pr-24 font-mono text-xs text-slate-100 overflow-x-auto select-all leading-relaxed">
              {installCmd}
            </pre>
            <button
              type="button"
              onClick={handleCopyCmd}
              className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 text-xs font-mono transition-colors cursor-pointer"
            >
              {copiedCmd ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span>{copiedCmd ? "Copied" : "Copy"}</span>
            </button>
          </div>

          {/* Key Advantages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
            <div className="rounded-[4px] border border-[#eaeaea] bg-[#fafafa] p-3.5">
              <div className="flex items-center gap-1.5 font-semibold text-[#111] mb-1">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                <span>Zero DB Credentials</span>
              </div>
              <p className="text-[12px] text-[#666] leading-relaxed">
                The agent only holds a scoped HTTPS bearer token. Database URLs, credentials, and app secrets never touch the agent.
              </p>
            </div>

            <div className="rounded-[4px] border border-[#eaeaea] bg-[#fafafa] p-3.5">
              <div className="flex items-center gap-1.5 font-semibold text-[#111] mb-1">
                <Zap className="size-3.5 text-indigo-600" />
                <span>Daemon Autostart</span>
              </div>
              <p className="text-[12px] text-[#666] leading-relaxed">
                Automatically registers with PM2 (<code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-[#e5e5e5]">carf-agent</code>) or configures a systemd service unit to survive reboots.
              </p>
            </div>

            <div className="rounded-[4px] border border-[#eaeaea] bg-[#fafafa] p-3.5">
              <div className="flex items-center gap-1.5 font-semibold text-[#111] mb-1">
                <Server className="size-3.5 text-blue-600" />
                <span>Live Preflight Checks</span>
              </div>
              <p className="text-[12px] text-[#666] leading-relaxed">
                Performs daemon reachability, process table lookup, HTTP probe responses, and layout write permissions before deployment verification.
              </p>
            </div>
          </div>
        </section>

        {/* Supported Deployment Stacks & 1-Click Integrations */}
        <section className="mb-10 border border-[#eaeaea] bg-[#fafafa] rounded-[6px] p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#eaeaea]">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#666] uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#111]" />
                Platform Integrations
              </div>
              <h2 className="font-['Lora',Georgia,serif] text-[20px] font-semibold text-[#0a0a0a]">
                Zero-Friction Protection for Modern Clouds
              </h2>
            </div>
            <span className="text-[11px] text-[#666] font-mono bg-[#ffffff] px-2.5 py-1 rounded-[4px] border border-[#e0e0e0] self-start sm:self-auto">
              Auto Stack Recognition
            </span>
          </div>

          <p className="text-[13px] text-[#555] mb-4">
            Step-by-step setup for a normal GitHub project, then PM2 (standalone, live) and planned augment integrations (Argo Rollouts, Render, Prometheus).{" "}
            <a href="#guide" className="font-medium text-[#111] underline underline-offset-2">
              Open the full guide
            </a>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PM2 Card */}
            <div className="border border-[#e5e5e5] bg-white rounded-[6px] p-4 flex flex-col justify-between shadow-2xs hover:border-[#bbb] transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-semibold text-[#111] text-[14px]">
                    <Terminal className="w-4 h-4 text-emerald-600" />
                    <span>PM2 &amp; systemd</span>
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live
                  </span>
                </div>
                <p className="text-[12px] text-[#666] leading-[1.6]">
                  Capistrano release layout (/var/www/releases) or git worktree with zero-downtime cluster reloads and instant rollback.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#f0f0f0] flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50/70 p-2 rounded">
                  ln -sfn releases/prev current &amp;&amp; pm2 reload
                </span>
                <a href="#pm2" className="text-[11px] font-medium text-[#111] shrink-0">
                  Guide →
                </a>
              </div>
            </div>

            {/* Render Card */}
            <div className="border border-[#e5e5e5] bg-white rounded-[6px] p-4 flex flex-col justify-between shadow-2xs hover:border-[#bbb] transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-semibold text-[#111] text-[14px]">
                    <Server className="w-4 h-4 text-indigo-600" />
                    <span>Render.com</span>
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Planned
                  </span>
                </div>
                <p className="text-[12px] text-[#666] leading-[1.6]">
                  Deploy Hook triggers and health endpoint polling for calculated soak duration before release sign-off.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#f0f0f0] flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50/70 p-2 rounded">
                  Deploy Hook + /healthz soak window
                </span>
                <a href="#render" className="text-[11px] font-medium text-[#111] shrink-0">
                  Guide →
                </a>
              </div>
            </div>

            {/* Kubernetes & Argo Rollouts Card */}
            <div className="border border-[#e5e5e5] bg-white rounded-[6px] p-4 flex flex-col justify-between shadow-2xs hover:border-[#bbb] transition-all">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-semibold text-[#111] text-[14px]">
                    <Server className="w-4 h-4 text-blue-600" />
                    <span>Kubernetes / Argo</span>
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Planned
                  </span>
                </div>
                <p className="text-[12px] text-[#666] leading-[1.6]">
                  Dynamic AnalysisTemplate webhooks feeding calibrated canary error thresholds into progressive delivery.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#f0f0f0] flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-blue-700 bg-blue-50/70 p-2 rounded">
                  GET /v1/augment/threshold (Planned)
                </span>
                <a href="#kubernetes" className="text-[11px] font-medium text-[#111] shrink-0">
                  Guide →
                </a>
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
          <a
            href="#guide"
            className="inline-flex items-center bg-white hover:bg-[#f7f7f7] border border-[#e0e0e0] text-[#111] font-['Inter',system-ui,sans-serif] text-[14px] font-medium px-4 py-2.5 rounded-[5px] transition-colors"
          >
            Read the guide
          </a>
        </div>
      </main>
    </SiteChrome>
  );
}
