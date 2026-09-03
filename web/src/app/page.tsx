"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { InteractiveSystemFlow } from "@/components/InteractiveSystemFlow";
import { ArchitectureFlowDiagram } from "@/components/ArchitectureFlowDiagram";

const TOC = [
  { id: "problem-statement", label: "Problem statement" },
  { id: "what-is-carf", label: "What CARF is" },
  { id: "target-users", label: "Target users & operational modes" },
  { id: "system-architecture", label: "System architecture & flow" },
  { id: "feature-breakdown", label: "Feature specification & classifiers" },
  { id: "algorithms-formulas", label: "Algorithms & mathematical formulas" },
  { id: "evaluation-harness", label: "Evaluation harness (H1 proof)" },
  { id: "technical-stack", label: "Technical stack & build order" },
  { id: "related-work", label: "Related work" },
  { id: "research-gaps-closed", label: "Research gaps closed" },
];

export default function ProposedArchitectureLandingPage() {
  const [active, setActive] = useState("problem-statement");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    TOC.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <main className="bg-white">

      {/* ── Header / Hero Section (Thinking Machines styling) ── */}
      <div className="max-w-[720px] mx-auto px-6 pt-16 pb-10">
        <div className="mb-4">
          <span className="font-['Inter',system-ui,sans-serif] text-[11px] font-semibold tracking-[0.12em] uppercase text-[#111] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px] border border-[#e5e5e5]">
            Proposed Technical Implementation & Architecture
          </span>
        </div>
        <h1
          className="font-['Lora',Georgia,serif] text-[2.2rem] leading-[1.18] font-semibold tracking-[-0.025em] text-[#0a0a0a] mb-5"
        >
          CARF: Change-Aware Rollback Decision Framework for DevOps Pipelines
        </h1>
        <p className="font-['Inter',system-ui,sans-serif] text-[15px] leading-[1.6] text-[#555] mb-6">
          A framework-agnostic decision layer and sidecar protocol that inspects commit diffs via Tier 1 path matching & Tier 2 Tree-Sitter AST parsing to dynamically tune canary rollback thresholds in real time.
        </p>
        <div className="flex flex-wrap items-center gap-3 font-['Inter',system-ui,sans-serif] text-[13px] text-[#777]">
          <span className="font-medium text-[#222]">CARF Core Engineering Team</span>
          <span className="text-[#ccc]">·</span>
          <span className="bg-[#f0f0f0] text-[#333] px-2 py-0.5 rounded text-[12px] font-mono">v1.0 Implementation Specs</span>
          <span className="text-[#ccc]">·</span>
          <Link href="/paper" className="text-[#111] font-medium underline underline-offset-2 hover:opacity-60">
            View Conference Paper →
          </Link>
          <span className="text-[#ccc]">·</span>
          <a
            href="https://dashboard.carf.indevs.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#111] font-medium underline underline-offset-2 hover:opacity-60"
          >
            Connect your own deployment →
          </a>
        </div>
      </div>

      {/* ── Interactive System Flow & Pipeline Simulator (Thinking Machines style widget) ── */}
      <div className="max-w-[960px] mx-auto px-6 mb-16">
        <InteractiveSystemFlow />
      </div>

      {/* ── Content shell: left TOC + article ── */}
      <div className="max-w-[1060px] mx-auto px-6 pb-32">
        <div className="flex gap-16 items-start">

          {/* Left sticky TOC */}
          <nav
            aria-label="Table of contents"
            className="hidden lg:block sticky top-20 w-[200px] shrink-0 font-['Inter',system-ui,sans-serif] text-[12.5px] leading-[1.55]"
          >
            <div className="font-semibold text-[#111] uppercase tracking-wider text-[10px] mb-3 text-[#888]">
              Proposed Specs TOC
            </div>
            <ul className="space-y-[3px]">
              {TOC.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`block py-[3px] no-underline transition-colors duration-150 ${
                      active === id ? "text-[#111] font-medium" : "text-[#aaa] hover:text-[#555]"
                    }`}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-8 pt-4 border-t border-[#eee]">
              <div className="text-[11px] text-[#888] mb-2 font-mono">Related Documents:</div>
              <Link
                href="/paper"
                className="block text-[12px] font-medium text-[#111] hover:underline mb-2"
              >
                📄 Conference Paper Overview
              </Link>
              <a
                href="https://github.com/dineshkorukonda/CARF"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[12px] text-[#666] hover:text-[#111]"
              >
                ↗ GitHub Repository
              </a>
            </div>
          </nav>

          {/* Article Specs */}
          <article className="min-w-0 flex-1 max-w-[640px] font-['Lora',Georgia,serif] text-[17px] leading-[1.75] text-[#222]">

            {/* Executive Summary TL;DR box */}
            <div className="mb-10 pl-5 border-l-[3px] border-[#111] bg-[#f7f7f7] py-4 pr-5 font-['Inter',system-ui,sans-serif] text-[14px] leading-[1.65] text-[#333]">
              <p className="m-0">
                <strong className="text-[#111]">One-Line Architectural Pitch&ensp;</strong>
                Existing rollback tools (Argo Rollouts, Flagger) decide purely from metrics—they don&apos;t know if a diff was a typo fix or a schema migration. CARF reads the actual change framework-agnostically and tells any pipeline how strict to be via stable webhook APIs.
              </p>
            </div>

            {/* § 1. Problem Statement */}
            <h2
              id="problem-statement"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.3rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-0 mb-3"
            >
              1. Problem Statement
            </h2>
            <p className="mb-4">
              Automated rollback systems in production today — Argo Rollouts, Flagger, Spinnaker/Kayenta — decide rollback purely from post-deploy metrics (error rate, latency, availability) compared against a <strong>static threshold</strong>. They have no concept of <em>what actually changed</em> in the deployment. A one-line copy fix and a database schema migration are watched with identical tolerance and identical observation windows.
            </p>
            <p className="mb-4">
              This produces two concrete failure modes:
            </p>
            <ul className="mb-5 pl-6 space-y-2 list-disc font-['Inter',system-ui,sans-serif] text-[14.5px] leading-[1.6]">
              <li>
                <strong>False-positive rollbacks</strong> — low-risk changes get rolled back on transient network noise, because the threshold was tuned conservatively enough to catch worst-case scenarios.
              </li>
              <li>
                <strong>Slow reaction on real failures</strong> — high-risk changes don&apos;t get caught fast enough, because the threshold was loosened to avoid false alarms on benign deployments.
              </li>
            </ul>
            <div className="my-6 p-4 bg-[#fafafa] border border-[#e5e5e5] rounded-[3px] font-['Inter',system-ui,sans-serif] text-[13.5px] text-[#333]">
              <strong>Research Hypothesis (H1):</strong> Change-type-aware dynamic thresholding reduces false-positive rollback rate compared to static-threshold rollback, at equal or better MTTR (mean time to recovery) on true-positive (real failure) cases.
            </div>

            {/* § 2. What CARF Is */}
            <h2
              id="what-is-carf"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.3rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              2. What CARF Is
            </h2>
            <p className="mb-4">
              CARF is a <strong>change-aware rollback decision protocol</strong> — a core engine plus a thin adapter layer — not a full platform and not a plugin locked to one orchestrator.
            </p>
            <p className="mb-3">Two governing design constraints shape the architecture:</p>
            <ol className="mb-5 pl-5 space-y-3 list-decimal font-['Inter',system-ui,sans-serif] text-[14.5px] leading-[1.6]">
              <li>
                <strong>Does not replace existing DevOps tooling:</strong> Where a team already runs Argo Rollouts or Flagger for canary analysis, CARF does not touch Kubernetes or execute anything — it only answers <em>&quot;how strict should you be for this specific commit,&quot;</em> via those tools&apos; native webhook interfaces.
              </li>
              <li>
                <strong>Works with any pipeline:</strong> Where no such tool exists (e.g. Docker Compose on a VM, or Jenkins SSH deployments), CARF&apos;s own lightweight standalone adapters run the health-check-and-decide loop and execute rollback directly.
              </li>
            </ol>

            {/* § 3. Target Users & Operating Modes */}
            <h2
              id="target-users"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.3rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              3. Target Users & Operating Modes
            </h2>
            <p className="mb-4">
              CARF explicitly supports two distinct operational segments with a single unified core engine:
            </p>

            <div className="my-6 overflow-x-auto">
              <table className="w-full text-left border-collapse font-['Inter',system-ui,sans-serif] text-[13px]">
                <thead>
                  <tr className="border-b border-[#111] bg-[#f5f5f5]">
                    <th className="py-2.5 px-3 font-semibold text-[#111]">Operating Mode</th>
                    <th className="py-2.5 px-3 font-semibold text-[#111]">When Used</th>
                    <th className="py-2.5 px-3 font-semibold text-[#111]">CARF&apos;s Execution Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee]">
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-[#111]">Augment Mode</td>
                    <td className="py-2.5 px-3 text-[#555]">Argo Rollouts or Flagger already deployed</td>
                    <td className="py-2.5 px-3 text-[#555]">Purely advisory — answers <code className="font-mono text-[11px] bg-[#eee] px-1 py-0.5">GET /v1/threshold</code> mid-canary. Never touches K8s directly.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-medium text-[#111]">Standalone Mode</td>
                    <td className="py-2.5 px-3 text-[#555]">No canary tooling present (Compose/VM/SSH)</td>
                    <td className="py-2.5 px-3 text-[#555]">Runs internal health-check loop, evaluates thresholds, and triggers execution adapters directly.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* § 4. System Architecture & Flow */}
            <h2
              id="system-architecture"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.3rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              4. System Architecture & Component Interaction
            </h2>
            <p className="mb-4">
              The data flow moves sequentially from commit arrival to vector storage and webhook resolution:
            </p>

            <ArchitectureFlowDiagram />

            <div className="my-6 pl-0 space-y-3 font-['Inter',system-ui,sans-serif] text-[14px]">
              {[
                { step: "1", title: "CI Trigger", desc: "PR merge triggers Git Webhook adapter passing target commit SHA and unified diff payload." },
                { step: "2", title: "Tier 1 Classifier", desc: "Fast path pattern matching classifies touched files into infra, dependency, config, data, or code buckets." },
                { step: "3", title: "Tier 2 Classifier", desc: "Tree-sitter structural diffing parses code files to calculate function modifications, signature changes, and nesting depth deltas." },
                { step: "4", title: "Vector Persistence", desc: "Normalized Change Vector {infra, dependency, config, code, data, code_complexity} is saved to PostgreSQL." },
                { step: "5", title: "Threshold Computation", desc: "Threshold Engine computes dynamic error tolerance limit and observation window according to §6.2 formula." },
                { step: "6", title: "Webhook Query", desc: "Argo Rollouts or Flagger AnalysisTemplate calls GET /v1/threshold?commit=SHA and applies strictness dynamically." },
              ].map((item) => (
                <div key={item.step} className="flex gap-3 items-start p-3 bg-[#fafafa] border border-[#eaeaea] rounded-[3px]">
                  <span className="bg-[#111] text-white font-mono text-[11px] w-5 h-5 flex items-center justify-center rounded-full shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <strong className="text-[#111]">{item.title}:</strong> <span className="text-[#444]">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* § 5. Feature Breakdown & Classifiers */}
            <h2
              id="feature-breakdown"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.3rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              5. Feature Breakdown & Classifiers
            </h2>

            <h3 className="font-['Lora',Georgia,serif] text-[1.1rem] font-semibold text-[#111] mt-6 mb-2">
              5.1 Tier 1 Classifier — Path & Manifest Pattern Engine
            </h3>
            <p className="mb-4">
              Tier 1 classifies changed files by artifact type with zero parsing overhead, ensuring framework-agnostic operation:
            </p>

            <div className="my-4 overflow-x-auto">
              <table className="w-full text-left border-collapse font-['Inter',system-ui,sans-serif] text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#111] bg-[#f5f5f5]">
                    <th className="py-2 px-3 font-semibold text-[#111]">File Pattern Matching</th>
                    <th className="py-2 px-3 font-semibold text-[#111]">Classification Vector Tag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee] font-mono text-[11.5px]">
                  <tr><td className="py-1.5 px-3">Dockerfile, docker-compose.yml</td><td className="py-1.5 px-3 text-[#05668d]">infra/container</td></tr>
                  <tr><td className="py-1.5 px-3">k8s/**/*.yaml, helm/**</td><td className="py-1.5 px-3 text-[#05668d]">infra/orchestration</td></tr>
                  <tr><td className="py-1.5 px-3">*.tf</td><td className="py-1.5 px-3 text-[#05668d]">infra/provisioning</td></tr>
                  <tr><td className="py-1.5 px-3">package.json, requirements.txt, go.mod</td><td className="py-1.5 px-3 text-[#7209b7]">dependency</td></tr>
                  <tr><td className="py-1.5 px-3">migrations/**</td><td className="py-1.5 px-3 text-[#d90429]">data/schema</td></tr>
                  <tr><td className="py-1.5 px-3">*.ts, *.go, *.py, *.rs, *.java</td><td className="py-1.5 px-3 text-[#38b000]">code (sent to Tier 2)</td></tr>
                </tbody>
              </table>
            </div>

            <h3 className="font-['Lora',Georgia,serif] text-[1.1rem] font-semibold text-[#111] mt-8 mb-2">
              5.2 Tier 2 Classifier — Tree-Sitter Structural Diff Parser
            </h3>
            <p className="mb-4">
              Files tagged as &quot;code&quot; are inspected using multi-language <code className="font-mono text-[12px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">tree-sitter</code> AST grammars (Python, Go, JS/TS, Rust, Java). Unlike Babel (which is JS/TS only), tree-sitter offers a uniform syntax-tree parsing API across languages to calculate structural delta:
            </p>
            <ul className="mb-5 pl-6 space-y-1.5 list-disc font-['Inter',system-ui,sans-serif] text-[14px]">
              <li>Functions and methods touched or renamed</li>
              <li>Function signature parameter additions/deletions</li>
              <li>Cyclomatic complexity & nesting depth delta</li>
            </ul>

            {/* § 6. Algorithms & Formulas */}
            <h2
              id="algorithms-formulas"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.3rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              6. Algorithms & Mathematical Formulas
            </h2>

            <h3 className="font-['Lora',Georgia,serif] text-[1.05rem] font-semibold text-[#111] mt-4 mb-2">
              6.1 Vector Normalization Algorithm
            </h3>
            <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-[4px] font-mono text-[12px] leading-[1.55] overflow-x-auto my-4">
{`// 1. Path-based tally
for file in commit.changed_files:
    type = match_path_pattern(file)
    tally[type] += 1

// 2. Structural AST complexity calculation (tree-sitter)
for file in tally["code"].files:
    ast_delta = tree_sitter_diff(file.before, file.after)
    complexity += compute_ast_score(ast_delta)

// 3. Output Change Vector Output:
change_vector = normalize({
    "infra": tally["infra"] / total_files,
    "dependency": tally["dependency"] / total_files,
    "config": tally["config"] / total_files,
    "code": tally["code"] / total_files,
    "code_complexity": min(1.0, complexity / max_complexity_ceiling)
})`}
            </pre>

            <h3 className="font-['Lora',Georgia,serif] text-[1.05rem] font-semibold text-[#111] mt-8 mb-2">
              6.2 Threshold Engine Mathematical Specification
            </h3>
            <p className="mb-3">
              The dynamic threshold formula calculates strictness decay across active change vector dimensions:
            </p>

            <div className="my-5 p-4 bg-[#f8f9fa] border border-[#e9ecef] rounded-[4px] font-mono text-[12.5px] leading-[1.6] text-[#111]">
              <div className="text-[#777] text-[11px] mb-2 font-sans">{"// Per-type decay contribution formula"}</div>
              <div>contribution[type] = base_threshold[type] × (1 − decay × change_vector[type])</div>
              <div>contribution_window[type] = base_window[type] × (1 − decay × change_vector[type])</div>
              <br />
              <div className="text-[#777] text-[11px] mb-2 font-sans">{"// Strictest vector constraint wins"}</div>
              <div>final_threshold = min(contribution[type] for type in active_types)</div>
              <div>final_window = min(contribution_window[type] for type in active_types)</div>
              <br />
              <div className="text-[#777] text-[11px] mb-2 font-sans">{"// Code complexity penalty factor"}</div>
              <div>if code_complexity &gt; 0:</div>
              <div className="pl-4">final_threshold *= (1 − complexity_decay × code_complexity)</div>
            </div>

            <p className="mb-5">
              <strong>Calibrating the constants.</strong> <code className="font-mono text-[12px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">decay</code>, <code className="font-mono text-[12px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">complexity_decay</code>, and the per-type <code className="font-mono text-[12px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">base_threshold</code> / <code className="font-mono text-[12px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">base_window</code> values are not hand-picked. They are fit via grid search against the evaluation harness in §7, optimizing for false-positive rollback rate at equal-or-better true-positive MTTR (per hypothesis H1). A sensitivity sweep is run around the selected values to confirm the resulting metrics are not a knife-edge function of any single constant — i.e., small perturbations to <code className="font-mono text-[12px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">decay</code> or <code className="font-mono text-[12px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">complexity_decay</code> should produce small, monotonic changes in FPR and MTTR, not discontinuous jumps. This grid-search-plus-sensitivity-check process is reported alongside the results, not just the final constants.
            </p>

            {/* § 7. Evaluation Harness */}
            <h2
              id="evaluation-harness"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.3rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              7. Evaluation Harness (Proving H1)
            </h2>
            <p className="mb-4">
              To prove hypothesis H1 empirically, CARF includes a synthetic deployment injector and A/B comparison harness:
            </p>

            <div className="my-5 p-5 border border-[#eaeaea] bg-[#fafafa] rounded-[4px] font-['Inter',system-ui,sans-serif] text-[13.5px]">
              <h4 className="font-semibold text-[#111] text-[14px] mt-0 mb-2">Experimental Comparison Setup</h4>
              <ul className="pl-5 space-y-2 list-disc text-[#444]">
                <li><strong>Synthetic Injector:</strong> Generates N deployments against a microservices target app (50% safe copy/log tweaks vs 50% risky schema/resource limit shifts).</li>
                <li><strong>Condition A (Baseline):</strong> Static metric threshold matching standard Argo Rollouts / Flagger defaults.</li>
                <li><strong>Condition B (CARF):</strong> Dynamic thresholds computed via CARF Change Vector engine.</li>
                <li><strong>Key Evaluation Metrics:</strong> False Positive Rate (unnecessary rollbacks on safe commits), True Positive MTTR, Precision, Recall.</li>
              </ul>
            </div>

            <p className="mb-5">
              <strong>Why synthetic injection.</strong> Real production incident logs rarely carry a reliable ground-truth label for the question this evaluation needs answered: <em>was this specific rollback actually necessary?</em> Incidents are recorded after the fact, mixed with confounding causes, and biased toward whatever a team&apos;s existing (static-threshold) tooling already chose to flag — which makes them unsuitable for testing whether a <em>different</em> thresholding approach would have made a better call. Synthetic injection avoids this by construction: each generated deployment is seeded as known-safe or known-risky before it runs, giving a clean label to measure false positives and true positives against. This is standard practice in chaos engineering and fault-injection research more broadly — production and staging environments are typically too large, too distributed, or too risky to reproduce faithfully for controlled comparison, so hypothesis-driven synthetic fault injection is treated as the accepted methodology for this kind of evaluation, not a lesser substitute for real-world data.
            </p>

            {/* § 8. Technical Stack & Build Order */}
            <h2
              id="technical-stack"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.3rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              8. Proposed Technical Stack & Roadmap
            </h2>

            <div className="my-4 font-['Inter',system-ui,sans-serif] text-[13.5px] space-y-2">
              <div><strong className="text-[#111]">Core Backend (<code className="font-mono text-[12px] bg-[#eee] px-1">core-api/</code>):</strong> TypeScript, Node.js, Fastify framework.</div>
              <div><strong className="text-[#111]">Database & ORM:</strong> PostgreSQL with Prisma ORM (persisting commits, vector store, evaluation logs).</div>
              <div><strong className="text-[#111]">AST Parsing:</strong> <code className="font-mono text-[12px] bg-[#eee] px-1">tree-sitter</code> + per-language bindings (<code className="font-mono text-[12px] bg-[#eee] px-1">tree-sitter-python</code>, <code className="font-mono text-[12px] bg-[#eee] px-1">tree-sitter-go</code>, <code className="font-mono text-[12px] bg-[#eee] px-1">tree-sitter-typescript</code>).</div>
              <div><strong className="text-[#111]">Integrations:</strong> Argo Rollouts AnalysisTemplate, Flagger Webhook Metric, Prometheus, Datadog, Docker Compose CLI, kubectl.</div>
            </div>

            {/* § 9. Related Work */}
            <h2
              id="related-work"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.3rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              9. Related Work
            </h2>
            <p className="mb-4">
              Risk-aware deployment tooling is not new. A parallel line of work proposes a Deployment Risk Index (DRI) — a weighted score computed from properties of the deployment target itself (package size, target environment, team deployment history, service criticality) — used to select a rollout <em>strategy</em> (Big Bang, Rolling, Blue-Green, Canary, Feature Toggle) before the release begins. Similar risk-scoring approaches appear in industry rollout-policy systems, where an upgrade event&apos;s properties are scored up front to assign it to a low-, medium-, or high-risk deployment policy.
            </p>
            <p className="mb-4">
              CARF addresses a different, complementary problem. DRI-style systems ask <em>&quot;how should we deploy this?&quot;</em> — evaluated once, before rollout, based on what is being shipped and where. CARF asks <em>&quot;how strict should the canary gate be right now, for this specific commit?&quot;</em> — evaluated continuously, during the canary window, based on what actually changed in the diff itself.
            </p>
            <p className="mb-5">
              Where DRI scores the target and the package, CARF&apos;s Tier 1/Tier 2 classifiers score the structural content of the commit — file paths touched and AST-level code complexity — and translate that directly into a dynamic error-rate tolerance and observation window for an existing canary tool (Argo Rollouts, Flagger). CARF does not select a rollout strategy; it does not replace DRI-style pre-deployment risk assessment. It sits downstream of that decision, inside the canary analysis loop itself, and can be layered on top of a DRI-informed rollout choice rather than in competition with it.
            </p>

            {/* § 10. Research Gaps Closed */}
            <h2
              id="research-gaps-closed"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.3rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              10. Research Gaps Closed
            </h2>
            <p className="mb-4">
              This implementation directly addresses and resolves previous literature critiques:
            </p>

            <div className="my-6 overflow-x-auto">
              <table className="w-full text-left border-collapse font-['Inter',system-ui,sans-serif] text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#111] bg-[#f5f5f5]">
                    <th className="py-2.5 px-3 font-semibold text-[#111]">Previous Literature Critique</th>
                    <th className="py-2.5 px-3 font-semibold text-[#111]">CARF Implementation Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee] text-[#444]">
                  <tr><td className="py-2 px-3 font-medium text-[#111]">No concrete threshold algorithm</td><td className="py-2 px-3">§6.2 — Documented, versioned formula with decay parameters</td></tr>
                  <tr><td className="py-2 px-3 font-medium text-[#111]">Classification too simplistic for mixed changes</td><td className="py-2 px-3">§6.1 — Classifier outputs a weighted vector, not a single label</td></tr>
                  <tr><td className="py-2 px-3 font-medium text-[#111]">No experimental evaluation section</td><td className="py-2 px-3">§7 — Evaluation harness with synthetic injector & A/B comparison</td></tr>
                  <tr><td className="py-2 px-3 font-medium text-[#111]">Assumed Kubernetes specifically</td><td className="py-2 px-3">§4 — Augment + Standalone modes via generic adapter layer</td></tr>
                </tbody>
              </table>
            </div>

            {/* Bottom link to paper */}
            <div className="mt-12 pt-8 border-t border-[#eee]">
              <div className="p-5 bg-[#f4f4f4] rounded-[4px] font-['Inter',system-ui,sans-serif] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-[#111] text-[14px]">Read the Research Paper</div>
                  <div className="text-[12.5px] text-[#666]">Read the co-authored conference paper overview.</div>
                </div>
                <Link
                  href="/paper"
                  className="bg-[#111] text-white px-4 py-2 text-[13px] font-medium rounded hover:bg-[#333] transition-colors whitespace-nowrap"
                >
                  Go to Conference Paper →
                </Link>
              </div>
            </div>

          </article>
        </div>
      </div>
    </main>
  );
}
