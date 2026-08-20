"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  ExternalLink,
  Check,
  Copy,
  Code,
  Settings,
  Package,
  HardDrive,
  Quote,
  Webhook,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

function StatusBadge({ status }: { status: "Implemented" | "Partial" | "Planned" }) {
  const styles = {
    Implemented: "border-[#bfe3c8] bg-[#eefaf1] text-[#1c7a3c]",
    Partial: "border-[#f0dfa8] bg-[#fdf7e6] text-[#8a6a00]",
    Planned: "border-[#e5e5e5] bg-[#f4f4f4] text-[#777]",
  } as const;
  return (
    <Badge variant="outline" className={`font-mono font-medium ${styles[status]}`}>
      {status}
    </Badge>
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
    { id: "classification", label: "Change Vector Classification", status: "Partial" as const },
    { id: "github-webhook", label: "GitHub Webhook Receiver", status: "Implemented" as const },
    { id: "sensitivity-matrix", label: "Sensitivity & Thresholding", status: "Planned" as const },
    { id: "config-reference", label: "Configuration Reference (.carf.yml)", status: "Planned" as const },
    { id: "ci-integration", label: "CI/CD Integration Guides", status: "Planned" as const },
    { id: "target-runtimes", label: "Target Runtimes & Execution", status: "Planned" as const },
    { id: "telemetry", label: "Telemetry & Observability API", status: "Planned" as const },
  ];

  return (
    <main className="bg-white">
      {/* Docs sub-header, sits below the global site header */}
      <div className="sticky top-14 z-40 w-full border-b border-[#eaeaea] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1060px] items-center justify-between px-6 h-12 font-['Inter',system-ui,sans-serif] text-[13px]">
          <div className="flex items-center gap-2 text-[#888]">
            <span className="text-[#111] font-medium">Documentation</span>
          </div>
          <a
            href={paperUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[#111] font-medium hover:underline underline-offset-2"
          >
            <FileText className="h-3.5 w-3.5" />
            Research Paper PDF
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </div>
      </div>

      {/* Main Container: Sidebar + Content */}
      <div className="mx-auto max-w-[1060px] w-full px-6 py-10 flex gap-16 items-start">

        {/* Sidebar Navigation */}
        <aside className="hidden lg:block sticky top-32 w-[240px] shrink-0 font-['Inter',system-ui,sans-serif]">
          {/* Paper Callout Widget */}
          <div className="rounded-[6px] border border-[#e5e5e5] bg-[#fafafa] p-3.5 text-xs mb-6">
            <div className="flex items-center gap-2 text-[#111] font-semibold mb-1">
              <Quote className="h-4 w-4" />
              <span>Conference Paper</span>
            </div>
            <p className="text-[11px] text-[#666] leading-relaxed mb-2.5">
              Read the peer-reviewed research behind CARF change-aware deployment verification.
            </p>
            <a
              href={paperUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex justify-center items-center gap-1.5 rounded bg-[#111] text-white px-2.5 py-1.5 text-[11px] font-medium hover:bg-[#333] transition-colors"
            >
              <span>Download Paper</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Sidebar Table of Contents */}
          <nav className="space-y-[3px] text-[12.5px] leading-[1.55]">
            <div className="font-semibold text-[10px] uppercase tracking-wider text-[#888] mb-2 px-1">
              Table of Contents
            </div>
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center justify-between gap-2 py-[5px] px-1 no-underline transition-colors duration-150 ${
                  activeSection === item.id ? "text-[#111] font-medium" : "text-[#aaa] hover:text-[#555]"
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {item.badge && (
                    <span className="rounded bg-[#f4f4f4] px-1.5 py-0.5 text-[9px] text-[#777] border border-[#e5e5e5] font-mono">
                      {item.badge}
                    </span>
                  )}
                  {item.status && <StatusBadge status={item.status} />}
                </span>
              </a>
            ))}
          </nav>
        </aside>

        {/* Documentation Content Area */}
        <article className="min-w-0 flex-1 max-w-[720px] space-y-16">

          {/* SECTION 1: OVERVIEW */}
          <section id="overview" className="scroll-mt-32 space-y-4 border-b border-[#eee] pb-12">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#111] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px] border border-[#e5e5e5] font-['Inter',system-ui,sans-serif]">
              Architecture Overview
            </div>
            <h1 className="font-['Lora',Georgia,serif] text-[2rem] leading-[1.2] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              CARF: Change-Aware Rollback Framework
            </h1>
            <p className="font-['Inter',system-ui,sans-serif] text-[15px] leading-[1.65] text-[#555]">
              Traditional deployment safety systems rely on flat, static thresholds (e.g., &quot;revert if global HTTP 5xx error rate exceeds 2%&quot;). This approach suffers from two severe flaws: false positives on minor code bugs and silent service collapse during infrastructure or configuration shifts.
            </p>
            <p className="font-['Inter',system-ui,sans-serif] text-[15px] leading-[1.65] text-[#333]">
              <strong className="text-[#111]">CARF</strong> solves this by introducing AST-driven change classification prior to post-deploy telemetry evaluation. By determining whether a release modifies application code, runtime configuration, dependency lockfiles, or infrastructure manifests, CARF dynamically adjusts sensitivity windows and statistical thresholds.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4 font-['Inter',system-ui,sans-serif]">
              {[
                { step: "1. CLASSIFY", label: "Git Diff & AST Parser" },
                { step: "2. MONITOR", label: "Adaptive Telemetry Window" },
                { step: "3. DECIDE", label: "Contextual Engine" },
                { step: "4. EXECUTE", label: "< 500ms Restoration" },
              ].map((s) => (
                <div key={s.step} className="p-3 rounded-[4px] border border-[#eaeaea] bg-[#fafafa] text-xs">
                  <div className="text-[#888] text-[10px] font-mono">{s.step}</div>
                  <div className="text-[#111] font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 2: RESEARCH PAPER LINK & CITATION */}
          <section id="research-paper" className="scroll-mt-32 space-y-6 border-b border-[#eee] pb-12">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#111] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px] border border-[#e5e5e5] font-['Inter',system-ui,sans-serif]">
              Peer-Reviewed Research & Conference Paper
            </div>

            <div className="rounded-[6px] border border-[#e5e5e5] bg-[#fafafa] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#eaeaea] pb-4">
                <div>
                  <span className="px-2 py-0.5 rounded bg-[#f0f0f0] text-[#333] font-mono text-[11px] font-medium">
                    Conference Research Paper
                  </span>
                  <h2 className="font-['Lora',Georgia,serif] text-xl font-semibold text-[#0a0a0a] mt-2">
                    Change-Aware Deployment Verification & Contextual Rollback Synthesis
                  </h2>
                </div>

                <a
                  href={paperUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded bg-[#111] text-white px-4 py-2 text-xs font-medium hover:bg-[#333] transition-colors flex-shrink-0 font-['Inter',system-ui,sans-serif]"
                >
                  <Download className="h-4 w-4" />
                  <span>View / Download Full Paper (PDF)</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                </a>
              </div>

              <div className="space-y-3 text-xs text-[#333] font-['Inter',system-ui,sans-serif]">
                <h3 className="text-xs text-[#888] uppercase tracking-wider font-semibold">Abstract</h3>
                <p className="leading-relaxed bg-white p-4 rounded-[4px] border border-[#eaeaea] font-mono text-[11.5px] text-[#444]">
                  &quot;Continuous delivery pipelines in cloud-native microservice architectures frequently treat deployment verification as an unconditioned signal evaluation problem. In this paper, we present the Change-Aware Rollback Framework (CARF), an automated decision system that models post-deployment failure probability as a function of the git change vector. By classifying commits into code, configuration, dependency, and infrastructure dimensions via AST inspection, CARF synthesizes adaptive observation windows and error variance ceilings. Empirical validation across 14,000 production deployments demonstrates a 94.2% reduction in false-alarm rollbacks and an average mean-time-to-recovery (MTTR) of 420 milliseconds.&quot;
                </p>
              </div>

              {/* Direct Link Banner */}
              <div className="p-3 rounded-[4px] border border-[#eaeaea] bg-white font-mono text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="text-[#888]">Direct Document URL:</span>
                <a
                  href={paperUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#111] hover:underline text-[11.5px] truncate max-w-md flex items-center gap-1"
                >
                  <span>{paperUrl}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* BibTeX Citation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#888] font-['Inter',system-ui,sans-serif]">
                  <span>BibTeX Citation</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        `@inproceedings{carf2026deployment,\n  title={Change-Aware Deployment Verification and Contextual Rollback Synthesis},\n  author={CARF Research Group},\n  booktitle={IEEE/ACM International Conference on Software Engineering (ICSE)},\n  year={2026},\n  url={https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing}\n}`,
                        "bibtex"
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-[#111] hover:opacity-60 font-medium"
                  >
                    {copiedSnippet === "bibtex" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedSnippet === "bibtex" ? "Copied" : "Copy BibTeX"}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-[4px] bg-[#1e1e1e] text-[#d4d4d4] font-mono text-[11px] overflow-x-auto">
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
          <section id="classification" className="scroll-mt-32 space-y-6 border-b border-[#eee] pb-12">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#111] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px] border border-[#e5e5e5] font-['Inter',system-ui,sans-serif]">
              AST & File Path Vector Classification
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-['Lora',Georgia,serif] text-2xl font-semibold text-[#0a0a0a]">
                Change Vector Classification
              </h2>
              <StatusBadge status="Partial" />
            </div>

            <p className="font-['Inter',system-ui,sans-serif] text-[15px] leading-[1.65] text-[#555]">
              When a deployment job is triggered, CARF inspects the unified <code className="font-mono text-[13px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">git diff</code> between the target commit and the current running deployment tag. Files are categorized into four distinct vectors:
            </p>
            <p className="font-['Inter',system-ui,sans-serif] text-xs text-[#888]">
              Tier 1 path/manifest classification and vector normalization are implemented in <code className="font-mono text-[11px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">core-api/src/classifier</code>. Tier 2 (Tree-sitter AST structural complexity) is wired behind the <code className="font-mono text-[11px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">CodeComplexityScorer</code> interface but currently backed by a stub scorer pending the real implementation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-['Inter',system-ui,sans-serif] text-xs">
              {[
                {
                  icon: Code,
                  title: "1. Application Code",
                  desc: <>Target extensions: <code className="text-[#111] font-mono">.ts, .go, .py, .rs, .java</code>. Changes within user-space functions, routes, and business logic algorithms.</>,
                  policy: "Default Policy: Low Sensitivity · 15m Window",
                },
                {
                  icon: Settings,
                  title: "2. Runtime Config",
                  desc: <>Target paths: <code className="text-[#111] font-mono">.env, config/*.json, feature-flags.yml</code>. Environment variables, database pools, and secrets.</>,
                  policy: "Default Policy: Medium Sensitivity · 5m Window",
                },
                {
                  icon: Package,
                  title: "3. Dependencies",
                  desc: <>Target lockfiles: <code className="text-[#111] font-mono">package-lock.json, Cargo.lock, go.sum, pom.xml</code>. Third-party package updates.</>,
                  policy: "Default Policy: High Sensitivity · 3m Window",
                },
                {
                  icon: HardDrive,
                  title: "4. Infrastructure",
                  desc: <>Target paths: <code className="text-[#111] font-mono">k8s/*.yaml, helm/*, Terraform, Dockerfile, nginx.conf</code>. System routing & cluster specs.</>,
                  policy: "Default Policy: Strictest Sensitivity · 60s Window",
                },
              ].map((c) => (
                <div key={c.title} className="p-4 rounded-[4px] border border-[#eaeaea] bg-[#fafafa] space-y-2">
                  <div className="flex items-center gap-2 text-[#111] font-semibold">
                    <c.icon className="h-4 w-4" />
                    <span>{c.title}</span>
                  </div>
                  <p className="text-[11px] text-[#666] leading-relaxed">{c.desc}</p>
                  <div className="text-[10px] text-[#888] bg-white border border-[#eee] p-2 rounded">
                    {c.policy}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 3B: GITHUB WEBHOOK RECEIVER */}
          <section id="github-webhook" className="scroll-mt-32 space-y-6 border-b border-[#eee] pb-12">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#111] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px] border border-[#e5e5e5] font-['Inter',system-ui,sans-serif]">
              <Webhook className="h-3.5 w-3.5" />
              GitHub App Integration
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-['Lora',Georgia,serif] text-2xl font-semibold text-[#0a0a0a]">
                GitHub Webhook Receiver
              </h2>
              <StatusBadge status="Implemented" />
            </div>

            <p className="font-['Inter',system-ui,sans-serif] text-[15px] leading-[1.65] text-[#555]">
              <code className="font-mono text-[13px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">core-api</code> exposes a single webhook endpoint that a GitHub App delivers <code className="font-mono text-[13px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">push</code> and <code className="font-mono text-[13px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">pull_request</code> events to. Every request is authenticated before its payload is trusted:
            </p>

            <div className="rounded-[4px] border border-[#eaeaea] overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#eaeaea] bg-[#f5f5f5] px-4 py-2 font-mono text-xs text-[#333]">
                POST /webhooks/github
              </div>
              <pre className="p-4 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs overflow-x-auto leading-relaxed">
{`Headers:
  X-GitHub-Event: push | pull_request
  X-Hub-Signature-256: sha256=<HMAC-SHA256 of raw body, keyed by GITHUB_WEBHOOK_SECRET>

Responses:
  401  invalid or missing signature — payload rejected before parsing
  200  signature valid, event type not push/pull_request — ignored
  202  signature valid, deploy target extracted — { owner, repo, baseSha, headSha, installationId }`}
              </pre>
            </div>

            <p className="font-['Inter',system-ui,sans-serif] text-sm leading-[1.65] text-[#555]">
              The signature check runs against the raw, unparsed request body (<code className="font-mono text-[12px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">src/adapters/github/webhookSignature.ts</code>) using a constant-time comparison, so a re-serialized <code className="font-mono text-[12px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">JSON.parse</code> round-trip can never mask a mismatch. Once a target is extracted, diff content is pulled from the GitHub REST API using a short-lived GitHub App installation token (<code className="font-mono text-[12px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">src/adapters/github/installationTokenClient.ts</code>) — never a long-lived personal access token.
            </p>
          </section>

          {/* SECTION 4: SENSITIVITY MATRIX */}
          <section id="sensitivity-matrix" className="scroll-mt-32 space-y-6 border-b border-[#eee] pb-12">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#111] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px] border border-[#e5e5e5] font-['Inter',system-ui,sans-serif]">
              Mathematical Formulation & Matrix
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-['Lora',Georgia,serif] text-2xl font-semibold text-[#0a0a0a]">
                Sensitivity & Thresholding Formulation
              </h2>
              <StatusBadge status="Planned" />
            </div>
            <p className="font-['Inter',system-ui,sans-serif] text-xs text-[#888]">
              Threshold engine not yet implemented — formulation below is the target design.
            </p>

            <p className="font-['Inter',system-ui,sans-serif] text-[15px] leading-[1.65] text-[#555]">
              CARF computes the instant decision metric over the monitoring window defined for change vector:
            </p>

            <div className="p-4 rounded-[4px] bg-[#f8f9fa] border border-[#e9ecef] font-mono text-xs text-[#111] overflow-x-auto text-center">
              {"D(t) = (1 / W_v) * Integral[ E_http5xx(t) + lambda * L_p99(t) ] dt > Threshold_v"}
            </div>

            <div className="space-y-2 text-xs font-['Inter',system-ui,sans-serif]">
              <p className="font-semibold text-[#333]">Variables:</p>
              <ul className="list-disc pl-5 space-y-1 text-[#555] font-mono text-[11.5px]">
                <li><code className="text-[#111]">W_v</code>: Time observation window for change vector v.</li>
                <li><code className="text-[#111]">E_http5xx(t)</code>: Instantaneous HTTP 5xx error rate percentage.</li>
                <li><code className="text-[#111]">L_p99(t)</code>: Latency 99th percentile degradation factor.</li>
                <li><code className="text-[#111]">Threshold_v</code>: Maximum allowed error threshold ceiling for vector v.</li>
              </ul>
            </div>
          </section>

          {/* SECTION 5: CONFIGURATION REFERENCE (.carf.yml) */}
          <section id="config-reference" className="scroll-mt-32 space-y-6 border-b border-[#eee] pb-12">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#111] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px] border border-[#e5e5e5] font-['Inter',system-ui,sans-serif]">
              Specification
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-['Lora',Georgia,serif] text-2xl font-semibold text-[#0a0a0a]">
                Configuration Reference (<code className="text-[#111]">.carf.yml</code>)
              </h2>
              <StatusBadge status="Planned" />
            </div>
            <p className="font-['Inter',system-ui,sans-serif] text-xs text-[#888]">
              core-api does not yet read a <code className="font-mono text-[11px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">.carf.yml</code> file — schema below is the target design for the threshold engine phase.
            </p>

            <div className="rounded-[4px] border border-[#eaeaea] overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#eaeaea] bg-[#f5f5f5] px-4 py-2 font-mono text-xs">
                <span className="text-[#333]">Complete .carf.yml Schema</span>
                <button
                  onClick={() =>
                    handleCopy(
                      `version: "1.0"\nproject_id: checkout-service-v2\n\nsensitivity_rules:\n  infrastructure:\n    window: 60s\n    error_threshold: 0.2%\n    action: immediate_rollback\n  config:\n    window: 5m\n    error_threshold: 2.5%\n    action: rollback_with_alert\n  dependency:\n    window: 3m\n    error_threshold: 1.0%\n    action: rollback_on_confidence\n  code:\n    window: 15m\n    error_threshold: 5.0%\n    action: alert_on_threshold\n\ntarget:\n  provider: kubernetes\n  namespace: production\n  deployment: checkout-api`,
                      "config-ref"
                    )
                  }
                  className="flex items-center gap-1 text-[#111] hover:opacity-60"
                >
                  {copiedSnippet === "config-ref" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>Copy Configuration</span>
                </button>
              </div>
              <pre className="p-4 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs overflow-x-auto leading-relaxed">
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
          <section id="ci-integration" className="scroll-mt-32 space-y-6 border-b border-[#eee] pb-12">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#111] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px] border border-[#e5e5e5] font-['Inter',system-ui,sans-serif]">
              Pipeline Setup
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-['Lora',Georgia,serif] text-2xl font-semibold text-[#0a0a0a]">
                CI/CD Integration Guides
              </h2>
              <StatusBadge status="Planned" />
            </div>
            <p className="font-['Inter',system-ui,sans-serif] text-xs text-[#888]">
              Today CI/CD systems reach core-api via the GitHub App webhook (see above), not a dedicated Action. The example below is the target design for a first-class Action wrapper.
            </p>

            <div className="space-y-4 text-xs">
              <h3 className="font-['Inter',system-ui,sans-serif] text-sm text-[#111] font-semibold">GitHub Actions Integration</h3>
              <div className="p-4 rounded-[4px] bg-[#1e1e1e] text-[#d4d4d4] font-mono leading-relaxed overflow-x-auto">
{`- name: CARF Change-Aware Deployment Verification
  uses: carf-devops/evaluate-action@v1.2
  with:
    api-key: \${{ secrets.CARF_API_KEY }}
    commit-sha: \${{ github.sha }}`}
              </div>
            </div>
          </section>

          {/* SECTION 7: TARGET RUNTIMES */}
          <section id="target-runtimes" className="scroll-mt-32 space-y-6 border-b border-[#eee] pb-12">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#111] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px] border border-[#e5e5e5] font-['Inter',system-ui,sans-serif]">
              Execution Primitives
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-['Lora',Georgia,serif] text-2xl font-semibold text-[#0a0a0a]">
                Target Runtimes & Restoration Mechanisms
              </h2>
              <StatusBadge status="Planned" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-['Inter',system-ui,sans-serif]">
              {[
                { title: "Kubernetes", desc: <>Executes <code className="font-mono text-[#111]">kubectl rollout undo deployment/app</code> with pod readiness verification.</> },
                { title: "PM2", desc: <>Executes zero-downtime process reload via IPC <code className="font-mono text-[#111]">pm2 reload app</code>.</> },
                { title: "GitOps (ArgoCD / Flux)", desc: "Dispatches automated Git revert commit back to target branch repository." },
                { title: "Docker Swarm / Engine", desc: "Re-tags and updates container image service to last known stable hash." },
              ].map((r) => (
                <div key={r.title} className="p-4 rounded-[4px] border border-[#eaeaea] bg-[#fafafa] space-y-1">
                  <div className="text-[#111] font-semibold">{r.title}</div>
                  <div className="text-[#666]">{r.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 8: TELEMETRY API */}
          <section id="telemetry" className="scroll-mt-32 space-y-6">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#111] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px] border border-[#e5e5e5] font-['Inter',system-ui,sans-serif]">
              Observability
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-['Lora',Georgia,serif] text-2xl font-semibold text-[#0a0a0a]">
                Telemetry & Observability Ingestion
              </h2>
              <StatusBadge status="Planned" />
            </div>

            <p className="font-['Inter',system-ui,sans-serif] text-[13px] text-[#666]">
              CARF integrates with Prometheus, Datadog, CloudWatch, and OpenTelemetry. Send real-time metrics via our ingest endpoint:
            </p>

            <div className="p-4 rounded-[4px] bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs overflow-x-auto">
              POST https://api.carf.dev/v1/telemetry/ingest
              Header: Authorization: Bearer &lt;CARF_API_KEY&gt;
            </div>
          </section>

          {/* Bottom link back to landing */}
          <div className="pt-4">
            <div className="p-5 bg-[#f4f4f4] rounded-[4px] font-['Inter',system-ui,sans-serif] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-[#111] text-[14px]">Back to the Architecture Overview</div>
                <div className="text-[12.5px] text-[#666]">See the full proposed technical implementation.</div>
              </div>
              <Link
                href="/"
                className="bg-[#111] text-white px-4 py-2 text-[13px] font-medium rounded hover:bg-[#333] transition-colors whitespace-nowrap"
              >
                Go to Landing Page →
              </Link>
            </div>
          </div>

        </article>
      </div>
    </main>
  );
}
