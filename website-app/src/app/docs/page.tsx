"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Terminal,
  FileText,
  ExternalLink,
  BookOpen,
  GitBranch,
  Activity,
  Cpu,
  RotateCcw,
  Check,
  Copy,
  ChevronRight,
  Code,
  Settings,
  Package,
  HardDrive,
  ShieldCheck,
  ArrowLeft,
  Layers,
  Search,
  Download,
  Quote
} from "lucide-react";

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const paperUrl = "https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing";

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const navItems = [
    { id: "overview", label: "Overview & Core Concept" },
    { id: "research-paper", label: "Conference Research Paper", badge: "PDF" },
    { id: "classification", label: "Change Vector Classification" },
    { id: "sensitivity-matrix", label: "Sensitivity & Thresholding" },
    { id: "config-reference", label: "Configuration Reference (.carf.yml)" },
    { id: "ci-integration", label: "CI/CD Integration Guides" },
    { id: "target-runtimes", label: "Target Runtimes & Execution" },
    { id: "telemetry", label: "Telemetry & Observability API" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-black text-zinc-100 selection:bg-orange-500/20 selection:text-orange-300 font-sans">
      
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-black/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight text-white hover:opacity-90 transition-opacity"
            >
              <span className="tracking-widest text-orange-400">CARF</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="font-mono text-xs text-orange-400 flex items-center gap-1.5 font-medium">
              <BookOpen className="h-3.5 w-3.5" /> Documentation
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={paperUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded border border-orange-500/40 bg-orange-950/30 px-3 py-1.5 text-xs font-mono text-orange-300 hover:bg-orange-900/40 transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-orange-400" />
              <span>Research Paper PDF</span>
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>

            <Link
              href="/"
              className="flex items-center gap-1 text-xs font-mono text-zinc-400 hover:text-white transition-colors border-l border-zinc-800 pl-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Landing Page
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3">
          <div className="sticky top-20 space-y-6">
            
            {/* Paper Callout Widget */}
            <div className="rounded-lg border border-orange-500/30 bg-orange-950/10 p-3.5 font-mono text-xs">
              <div className="flex items-center gap-2 text-orange-400 font-semibold mb-1">
                <Quote className="h-4 w-4" />
                <span>Conference Paper</span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed mb-2.5">
                Read the peer-reviewed research behind CARF change-aware deployment verification.
              </p>
              <a
                href={paperUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex justify-center items-center gap-1.5 rounded bg-orange-500/10 border border-orange-500/40 px-2.5 py-1.5 text-[11px] font-mono text-orange-300 hover:bg-orange-500/20 transition-colors"
              >
                <span>Download Paper</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Sidebar Table of Contents */}
            <nav className="space-y-1 font-mono text-xs">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 px-2">Table of Contents</div>
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded transition-colors ${
                    activeSection === item.id
                      ? "bg-zinc-800 text-orange-400 border-l-2 border-orange-400 font-medium"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="rounded bg-orange-950 px-1.5 py-0.2 text-[9px] text-orange-400 border border-orange-800/50 font-mono">
                      {item.badge}
                    </span>
                  )}
                </a>
              ))}
            </nav>

          </div>
        </aside>

        {/* Documentation Content Area */}
        <main className="lg:col-span-9 space-y-16 text-zinc-300 text-sm leading-relaxed">
          
          {/* SECTION 1: OVERVIEW */}
          <section id="overview" className="scroll-mt-24 space-y-4 border-b border-zinc-800/80 pb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              ARCHITECTURE OVERVIEW
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white font-sans">
              CARF: Change-Aware Rollback Framework
            </h1>
            <p className="text-base text-zinc-400 leading-relaxed font-sans">
              Traditional deployment safety systems rely on flat, static thresholds (e.g., "revert if global HTTP 5xx error rate exceeds 2%"). This approach suffers from two severe flaws: false positives on minor code bugs and silent service collapse during infrastructure or configuration shifts.
            </p>
            <p className="text-zinc-300 font-sans">
              <strong>CARF</strong> solves this by introducing AST-driven change classification prior to post-deploy telemetry evaluation. By determining whether a release modifies application code, runtime configuration, dependency lockfiles, or infrastructure manifests, CARF dynamically adjusts sensitivity windows and statistical thresholds.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4">
              <div className="p-3 rounded border border-zinc-800 bg-[#0d0d10] font-mono text-xs">
                <div className="text-zinc-500 text-[10px]">1. CLASSIFY</div>
                <div className="text-orange-300 font-medium">Git Diff & AST Parser</div>
              </div>
              <div className="p-3 rounded border border-zinc-800 bg-[#0d0d10] font-mono text-xs">
                <div className="text-zinc-500 text-[10px]">2. MONITOR</div>
                <div className="text-orange-300 font-medium">Adaptive Telemetry Window</div>
              </div>
              <div className="p-3 rounded border border-zinc-800 bg-[#0d0d10] font-mono text-xs">
                <div className="text-zinc-500 text-[10px]">3. DECIDE</div>
                <div className="text-orange-300 font-medium">Contextual Engine</div>
              </div>
              <div className="p-3 rounded border border-zinc-800 bg-[#0d0d10] font-mono text-xs">
                <div className="text-zinc-500 text-[10px]">4. EXECUTE</div>
                <div className="text-orange-300 font-medium">&lt; 500ms Restoration</div>
              </div>
            </div>
          </section>

          {/* SECTION 2: RESEARCH PAPER LINK & CITATION */}
          <section id="research-paper" className="scroll-mt-24 space-y-6 border-b border-zinc-800/80 pb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              PEER-REVIEWED RESEARCH & CONFERENCE PAPER
            </div>

            <div className="rounded-lg border border-orange-500/40 bg-[#0c0c12] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                <div>
                  <span className="px-2 py-0.5 rounded bg-orange-950 border border-orange-800/60 font-mono text-[11px] text-orange-300">
                    Conference Research Paper
                  </span>
                  <h2 className="text-xl font-semibold text-white font-sans mt-2">
                    Change-Aware Deployment Verification & Contextual Rollback Synthesis
                  </h2>
                </div>

                <a
                  href={paperUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded bg-orange-500/20 border border-orange-400/60 px-4 py-2 text-xs font-mono font-medium text-orange-300 hover:bg-orange-500/30 transition-all flex-shrink-0"
                >
                  <Download className="h-4 w-4" />
                  <span>View / Download Full Paper (PDF)</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                </a>
              </div>

              <div className="space-y-3 font-sans text-xs text-zinc-300">
                <h3 className="font-mono text-xs text-orange-400 uppercase tracking-wider font-semibold">Abstract</h3>
                <p className="leading-relaxed text-zinc-300 bg-zinc-950 p-4 rounded border border-zinc-800 font-mono text-[11.5px]">
                  &quot;Continuous delivery pipelines in cloud-native microservice architectures frequently treat deployment verification as an unconditioned signal evaluation problem. In this paper, we present the Change-Aware Rollback Framework (CARF), an automated decision system that models post-deployment failure probability as a function of the git change vector. By classifying commits into code, configuration, dependency, and infrastructure dimensions via AST inspection, CARF synthesizes adaptive observation windows and error variance ceilings. Empirical validation across 14,000 production deployments demonstrates a 94.2% reduction in false-alarm rollbacks and an average mean-time-to-recovery (MTTR) of 420 milliseconds.&quot;
                </p>
              </div>

              {/* Direct Link Banner */}
              <div className="p-3 rounded border border-zinc-800 bg-zinc-900/60 font-mono text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="text-zinc-400">Direct Document URL:</span>
                <a
                  href={paperUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-400 hover:underline text-[11.5px] truncate max-w-md flex items-center gap-1"
                >
                  <span>{paperUrl}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* BibTeX Citation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span>BibTeX Citation</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        `@inproceedings{carf2026deployment,\n  title={Change-Aware Deployment Verification and Contextual Rollback Synthesis},\n  author={CARF Research Group},\n  booktitle={IEEE/ACM International Conference on Software Engineering (ICSE)},\n  year={2026},\n  url={https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing}\n}`,
                        "bibtex"
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300"
                  >
                    {copiedSnippet === "bibtex" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedSnippet === "bibtex" ? "Copied" : "Copy BibTeX"}</span>
                  </button>
                </div>
                <pre className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-400 overflow-x-auto">
{`@inproceedings{carf2026deployment,
  title={Change-Aware Deployment Verification and Contextual Rollback Synthesis},
  author={CARF Research Group},
  booktitle={IEEE/ACM International Conference on Software Engineering (ICSE)},
  year={2026},
  url={https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing}
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* SECTION 3: CHANGE VECTOR CLASSIFICATION */}
          <section id="classification" className="scroll-mt-24 space-y-6 border-b border-zinc-800/80 pb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              AST & FILE PATH VECTOR CLASSIFICATION
            </div>

            <h2 className="text-2xl font-bold text-white font-sans">
              Change Vector Classification
            </h2>

            <p className="text-zinc-400 font-sans">
              When a deployment job is triggered, CARF inspects the unified <code className="font-mono text-orange-300">git diff</code> between the target commit and the current running deployment tag. Files are categorized into four distinct vectors:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div className="p-4 rounded border border-zinc-800 bg-[#0c0c0f] space-y-2">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Code className="h-4 w-4 text-orange-400" />
                  <span>1. Application Code</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans">
                  Target extensions: <code className="text-orange-300">.ts, .go, .py, .rs, .java</code>. Changes within user-space functions, routes, and business logic algorithms.
                </p>
                <div className="text-[10px] text-zinc-500 bg-zinc-950 p-2 rounded">
                  Default Policy: Low Sensitivity · 15m Window
                </div>
              </div>

              <div className="p-4 rounded border border-zinc-800 bg-[#0c0c0f] space-y-2">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Settings className="h-4 w-4 text-amber-400" />
                  <span>2. Runtime Config</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans">
                  Target paths: <code className="text-orange-300">.env, config/*.json, feature-flags.yml</code>. Environment variables, database pools, and secrets.
                </p>
                <div className="text-[10px] text-zinc-500 bg-zinc-950 p-2 rounded">
                  Default Policy: Medium Sensitivity · 5m Window
                </div>
              </div>

              <div className="p-4 rounded border border-zinc-800 bg-[#0c0c0f] space-y-2">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Package className="h-4 w-4 text-orange-400" />
                  <span>3. Dependencies</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans">
                  Target lockfiles: <code className="text-orange-300">package-lock.json, Cargo.lock, go.sum, pom.xml</code>. Third-party package updates.
                </p>
                <div className="text-[10px] text-zinc-500 bg-zinc-950 p-2 rounded">
                  Default Policy: High Sensitivity · 3m Window
                </div>
              </div>

              <div className="p-4 rounded border border-zinc-800 bg-[#0c0c0f] space-y-2">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <HardDrive className="h-4 w-4 text-red-400" />
                  <span>4. Infrastructure</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans">
                  Target paths: <code className="text-orange-300">k8s/*.yaml, helm/*, Terraform, Dockerfile, nginx.conf</code>. System routing & cluster specs.
                </p>
                <div className="text-[10px] text-zinc-500 bg-zinc-950 p-2 rounded">
                  Default Policy: Strictest Sensitivity · 60s Window
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: SENSITIVITY MATRIX */}
          <section id="sensitivity-matrix" className="scroll-mt-24 space-y-6 border-b border-zinc-800/80 pb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              MATHEMATICAL FORMULATION & MATRIX
            </div>

            <h2 className="text-2xl font-bold text-white font-sans">
              Sensitivity & Thresholding Formulation
            </h2>

            <p className="text-zinc-400 font-sans">
              CARF computes the instant decision metric over the monitoring window defined for change vector:
            </p>

            <div className="p-4 rounded bg-zinc-950 border border-zinc-800 font-mono text-xs text-orange-300 overflow-x-auto text-center">
              {"D(t) = (1 / W_v) * Integral[ E_http5xx(t) + lambda * L_p99(t) ] dt > Threshold_v"}
            </div>

            <div className="space-y-2 text-xs font-sans">
              <p className="font-semibold text-zinc-200">Variables:</p>
              <ul className="list-disc pl-5 space-y-1 text-zinc-400 font-mono text-[11.5px]">
                <li><code className="text-orange-400">W_v</code>: Time observation window for change vector v.</li>
                <li><code className="text-orange-400">E_http5xx(t)</code>: Instantaneous HTTP 5xx error rate percentage.</li>
                <li><code className="text-orange-400">L_p99(t)</code>: Latency 99th percentile degradation factor.</li>
                <li><code className="text-orange-400">Threshold_v</code>: Maximum allowed error threshold ceiling for vector v.</li>
              </ul>
            </div>
          </section>

          {/* SECTION 5: CONFIGURATION REFERENCE (.carf.yml) */}
          <section id="config-reference" className="scroll-mt-24 space-y-6 border-b border-zinc-800/80 pb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              SPECIFICATION
            </div>

            <h2 className="text-2xl font-bold text-white font-sans">
              Configuration Reference (<code className="text-orange-400">.carf.yml</code>)
            </h2>

            <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2 font-mono text-xs">
                <span className="text-zinc-300">Complete .carf.yml Schema</span>
                <button
                  onClick={() =>
                    handleCopy(
                      `version: "1.0"\nproject_id: checkout-service-v2\n\nsensitivity_rules:\n  infrastructure:\n    window: 60s\n    error_threshold: 0.2%\n    action: immediate_rollback\n  config:\n    window: 5m\n    error_threshold: 2.5%\n    action: rollback_with_alert\n  dependency:\n    window: 3m\n    error_threshold: 1.0%\n    action: rollback_on_confidence\n  code:\n    window: 15m\n    error_threshold: 5.0%\n    action: alert_on_threshold\n\ntarget:\n  provider: kubernetes\n  namespace: production\n  deployment: checkout-api`,
                      "config-ref"
                    )
                  }
                  className="flex items-center gap-1 text-orange-400 hover:text-orange-300"
                >
                  {copiedSnippet === "config-ref" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>Copy Configuration</span>
                </button>
              </div>
              <pre className="p-4 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed">
{`version: "1.0"
project_id: checkout-service-v2

# Adaptive risk sensitivity per change vector
sensitivity_rules:
  infrastructure:
    window: 60s
    error_threshold: 0.2%
    action: immediate_rollback
  config:
    window: 5m
    error_threshold: 2.5%
    action: rollback_with_alert
  dependency:
    window: 3m
    error_threshold: 1.0%
    action: rollback_on_confidence
  code:
    window: 15m
    error_threshold: 5.0%
    action: alert_on_threshold

target:
  provider: kubernetes # Options: kubernetes, pm2, docker, gitops, helm, ecs
  namespace: production
  deployment: checkout-api`}
              </pre>
            </div>
          </section>

          {/* SECTION 6: CI INTEGRATION GUIDES */}
          <section id="ci-integration" className="scroll-mt-24 space-y-6 border-b border-zinc-800/80 pb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              PIPELINE SETUP
            </div>

            <h2 className="text-2xl font-bold text-white font-sans">
              CI/CD Integration Guides
            </h2>

            <div className="space-y-4 font-sans text-xs">
              <h3 className="font-mono text-sm text-orange-300 font-semibold">GitHub Actions Integration</h3>
              <div className="p-4 rounded border border-zinc-800 bg-[#0c0c0f] font-mono leading-relaxed text-zinc-300 overflow-x-auto">
{`- name: CARF Change-Aware Deployment Verification
  uses: carf-devops/evaluate-action@v1.2
  with:
    api-key: \${{ secrets.CARF_API_KEY }}
    commit-sha: \${{ github.sha }}`}
              </div>
            </div>
          </section>

          {/* SECTION 7: TARGET RUNTIMES */}
          <section id="target-runtimes" className="scroll-mt-24 space-y-6 border-b border-zinc-800/80 pb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              EXECUTION PRIMITIVES
            </div>

            <h2 className="text-2xl font-bold text-white font-sans">
              Target Runtimes & Restoration Mechanisms
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded border border-zinc-800 bg-zinc-950 space-y-1">
                <div className="text-white font-semibold">Kubernetes</div>
                <div className="text-zinc-400 font-sans">Executes <code className="text-orange-300">kubectl rollout undo deployment/app</code> with pod readiness verification.</div>
              </div>
              <div className="p-4 rounded border border-zinc-800 bg-zinc-950 space-y-1">
                <div className="text-white font-semibold">PM2</div>
                <div className="text-zinc-400 font-sans">Executes zero-downtime process reload via IPC <code className="text-orange-300">pm2 reload app</code>.</div>
              </div>
              <div className="p-4 rounded border border-zinc-800 bg-zinc-950 space-y-1">
                <div className="text-white font-semibold">GitOps (ArgoCD / Flux)</div>
                <div className="text-zinc-400 font-sans">Dispatches automated Git revert commit back to target branch repository.</div>
              </div>
              <div className="p-4 rounded border border-zinc-800 bg-zinc-950 space-y-1">
                <div className="text-white font-semibold">Docker Swarm / Engine</div>
                <div className="text-zinc-400 font-sans">Re-tags and updates container image service to last known stable hash.</div>
              </div>
            </div>
          </section>

          {/* SECTION 8: TELEMETRY API */}
          <section id="telemetry" className="scroll-mt-24 space-y-6">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              OBSERVABILITY
            </div>

            <h2 className="text-2xl font-bold text-white font-sans">
              Telemetry & Observability Ingestion
            </h2>

            <p className="text-zinc-400 font-sans text-xs">
              CARF integrates with Prometheus, Datadog, CloudWatch, and OpenTelemetry. Send real-time metrics via our ingest endpoint:
            </p>

            <div className="p-4 rounded border border-zinc-800 bg-[#0c0c0f] font-mono text-xs text-zinc-300 overflow-x-auto">
              POST https://api.carf.dev/v1/telemetry/ingest
              Header: Authorization: Bearer &lt;CARF_API_KEY&gt;
            </div>
          </section>

        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-[#050507] text-xs font-mono text-zinc-500 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-orange-400 font-semibold">CARF</span> Documentation & Research Portal
          </div>
          <div>
            <a href={paperUrl} target="_blank" rel="noreferrer" className="text-orange-400 hover:underline">
              Conference Paper PDF
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
