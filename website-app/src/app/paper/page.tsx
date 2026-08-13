"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const TOC = [
  { id: "introduction", label: "Introduction" },
  { id: "motivation", label: "Why rollback needs to be smarter" },
  { id: "framework", label: "Our change-aware rollback framework" },
  { id: "architecture", label: "Four-phase architecture" },
  { id: "related", label: "How this differs from prior work" },
  { id: "benefits", label: "Why this matters" },
  { id: "status", label: "Current status and future work" },
  { id: "citation", label: "Citation" },
];

export default function PaperPage() {
  const [active, setActive] = useState("introduction");
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

      {/* ── Post heading — centered, Thinking Machines style ── */}
      <div className="max-w-[720px] mx-auto px-6 pt-16 pb-10">
        <div className="mb-3">
          <span className="font-['Inter',system-ui,sans-serif] text-[11px] font-semibold tracking-[0.12em] uppercase text-[#888] bg-[#f4f4f4] px-2.5 py-1 rounded-[3px]">
            Conference Paper Overview
          </span>
        </div>
        <h1
          className="font-['Lora',Georgia,serif] text-[2.1rem] leading-[1.15] font-semibold tracking-[-0.02em] text-[#0a0a0a] mb-5"
        >
          Change-Aware Automated Rollback Decisions for DevOps Pipelines
        </h1>
        <div className="flex flex-wrap items-center gap-2 font-['Inter',system-ui,sans-serif] text-[13px] text-[#888]">
          <span className="font-medium text-[#333]">Dinesh Korukonda, Tammineni Monika, Jonnalagadda Surya Kiran, Hemachand Pallam</span>
          <span className="text-[#ccc]">·</span>
          <span>Aug 2026</span>
        </div>
      </div>

      {/* ── Hero image ── */}
      <div className="max-w-[800px] mx-auto px-[#18px] px-6 mb-14">
        <Image
          src="/hero.jpg"
          alt="CARF system hero illustration"
          width={1732}
          height={824}
          priority
          className="w-full h-auto block rounded-[8px] border border-[#e5e5e5] shadow-xs"
        />
      </div>

      {/* ── Content shell: left TOC + article ── */}
      <div className="max-w-[1060px] mx-auto px-6 pb-32">
        <div className="flex gap-16 items-start">

          {/* Left sticky TOC */}
          <nav
            aria-label="Table of contents"
            className="hidden lg:block sticky top-20 w-[190px] shrink-0 font-['Inter',system-ui,sans-serif] text-[12.5px] leading-[1.55]"
          >
            <div className="font-semibold text-[#111] uppercase tracking-wider text-[10px] mb-3 text-[#999]">
              Paper Sections
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
              <Link
                href="/"
                className="text-[12px] font-medium text-[#111] hover:underline flex items-center gap-1"
              >
                ← View Proposed Tech Architecture & Stack
              </Link>
            </div>
          </nav>

          {/* Article */}
          <article className="min-w-0 flex-1 max-w-[640px] font-['Lora',Georgia,serif] text-[17.5px] leading-[1.75] text-[#222]">

            {/* TL;DR box */}
            <div className="mb-10 pl-5 border-l-[3px] border-[#111] bg-[#f7f7f7] py-4 pr-5 font-['Inter',system-ui,sans-serif] text-[14px] leading-[1.65] text-[#333]">
              <p className="m-0">
                <strong className="text-[#111]">TL;DR&ensp;</strong>
                We propose a DevOps rollback system that knows{" "}
                <em>what changed</em>, watches{" "}
                <em>how the system behaves</em>, and automatically rolls back
                only when needed—based on change-specific policies, not a
                one-size-fits-all threshold.
              </p>
            </div>

            {/* § Introduction */}
            <h2
              id="introduction"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.25rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-0 mb-3"
            >
              Introduction
            </h2>
            <p className="mb-5">
              Modern CI/CD pipelines ship code faster than ever. Teams deploy
              dozens of times a day across microservices, and any one of those
              deployments can silently degrade production. When something goes
              wrong, the first question is always:{" "}
              <em>should we roll back, and how quickly?</em>
            </p>
            <p className="mb-5">
              Current rollback mechanisms are reactive and undifferentiated.
              They trigger on the same thresholds regardless of whether a
              deployment was a one-line configuration change or a full
              dependency upgrade—two events with very different failure
              signatures and risk profiles. This paper proposes CARF, a
              change-aware, metric-driven framework that connects{" "}
              <em>what changed</em> in a deployment with{" "}
              <em>how the system behaves afterwards</em> to make rollback
              decisions automatically and precisely.
            </p>

            {/* § Motivation */}
            <h2
              id="motivation"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.25rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              Why rollback needs to be smarter
            </h2>
            <p className="mb-5">
              Continuous integration and delivery enable rapid, iterative
              software releases—but they also increase the surface area for
              production failures, performance regressions, and cascading
              instability in cloud-native, microservice architectures.
            </p>
            <p className="mb-5">
              Today&apos;s rollback mechanisms share a fundamental problem: they
              treat all deployments the same. Whether the change is a bug fix
              in a critical hot path, a config flag toggle, a library version
              bump, or an infrastructure resize, the same generic error-rate or
              latency threshold triggers the rollback decision. This leads to
              two failure modes:
            </p>
            <ul className="mb-5 pl-6 space-y-2 list-disc">
              <li>
                <strong>Too sensitive</strong>—benign config tweaks trigger
                unnecessary rollbacks, increasing MTTR and operator fatigue.
              </li>
              <li>
                <strong>Too blunt</strong>—risky dependency upgrades pass the
                same threshold and sit in production long enough to cause real
                harm.
              </li>
            </ul>
            <p className="mb-5">
              There is no unified framework in the literature that explicitly
              connects change classification with metric-driven rollback policy
              in cloud-native environments. CARF fills that gap.
            </p>

            {/* § Framework */}
            <h2
              id="framework"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.25rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              Our change-aware rollback framework
            </h2>
            <p className="mb-5">
              The core idea: classify the deployment by the type of change it
              introduces, then apply a rollback policy whose sensitivity is
              calibrated to that change type. A code-path change in a payment
              service deserves a tighter threshold than a documentation string
              update; an infrastructure resize deserves the tightest threshold
              of all.
            </p>
            <p className="mb-3">The framework has four responsibilities:</p>
            <ul className="mb-5 pl-6 space-y-2 list-disc">
              <li>
                Classify changes into one of four types:{" "}
                <strong>code, configuration, dependency, infrastructure</strong>.
              </li>
              <li>
                Collect runtime metrics in an observation window immediately
                after deployment: error rate, p95 latency, availability,
                container health.
              </li>
              <li>
                Apply a rule-based decision engine whose thresholds are keyed
                to the change type detected in step one.
              </li>
              <li>
                Execute rollback automatically via CI/CD or GitOps primitives
                (e.g.,{" "}
                <code className="font-mono text-[0.82em] bg-[#f4f4f4] px-[0.35em] py-[0.1em] rounded-[3px] text-[#333]">
                  kubectl rollout undo
                </code>
                , Git revert) when thresholds are breached.
              </li>
            </ul>

            {/* § Architecture */}
            <h2
              id="architecture"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.25rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              Four-phase architecture
            </h2>
            <p className="mb-5">
              The pipeline slots into existing delivery infrastructure with no
              changes to the deployment process itself. Each phase operates
              independently and communicates through a thin structured interface.
            </p>

            {/* Architecture diagram */}
            <figure className="my-8">
              <Image
                src="/carf-arch.jpg"
                alt="Four-phase CARF architecture: Change Classifier → Metrics Collector → Decision Engine → Rollback Executor"
                width={1400}
                height={788}
                className="w-full h-auto block rounded-[4px] border border-[#eee]"
              />
              <figcaption className="mt-3 font-['Inter',system-ui,sans-serif] text-[12.5px] leading-[1.5] text-[#888]">
                Figure 1. The four-phase CARF pipeline. A deployment enters
                the pre-deployment classifier, moves into post-deployment
                monitoring, automated decision logic, and finally rollback
                execution if needed.
              </figcaption>
            </figure>

            <ol className="mb-5 pl-0 space-y-3 list-none">
              {[
                {
                  n: "1",
                  title: "Pre-deployment — Change Classifier",
                  body: "Before the canary is promoted, the classifier inspects Git metadata: file diffs, commit history, touched paths, and dependency lockfiles. It emits a change-type tag (code / config / dependency / infra) that flows into the rest of the pipeline.",
                },
                {
                  n: "2",
                  title: "Monitoring — Metrics Collector",
                  body: "After deployment, the collector streams error rate, p95 latency, availability, and container health from Prometheus or Grafana during a configurable observation window.",
                },
                {
                  n: "3",
                  title: "Decision Engine",
                  body: "The engine selects a threshold policy based on the change-type tag. Code changes use low sensitivity; infrastructure changes use the strictest policy. If any metric breaches its threshold, the engine emits a rollback signal.",
                },
                {
                  n: "4",
                  title: "Recovery — Rollback Executor",
                  body: "On receiving a rollback signal, the executor runs kubectl rollout undo or a Git revert, restores the last stable version, records MTTR, and dispatches alerts via Slack or the team's observability dashboard.",
                },
              ].map((phase) => (
                <li
                  key={phase.n}
                  className="pl-5 border-l-[3px] border-[#111] py-3 pr-4 bg-[#fafafa]"
                >
                  <p className="m-0 text-[0.97rem] leading-[1.65]">
                    <strong>{phase.title}.</strong> {phase.body}
                  </p>
                </li>
              ))}
            </ol>

            {/* § Related work */}
            <h2
              id="related"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.25rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              How this differs from prior work
            </h2>
            <p className="mb-5">
              Prior research covers adjacent ground—CI/CD pipeline automation,
              anomaly detection, staged rollout strategies (canary, blue-green),
              GitOps traceability, and ML-based failure prediction—but
              typically treats failure detection and rollback decisions as
              separate concerns.
            </p>
            <ul className="mb-5 pl-6 space-y-2 list-disc">
              <li>
                <strong>Canary / blue-green strategies</strong> focus on how
                traffic is shifted, not on <em>what changed</em> and how
                sensitive rollback policy should therefore be.
              </li>
              <li>
                <strong>Anomaly detection and ML approaches</strong> predict
                failures from telemetry but do not encode rollback policies
                tied to deployment change types.
              </li>
              <li>
                <strong>GitOps tooling</strong> improves traceability but
                rollback triggers still rely on generic thresholds, not
                change-aware policies.
              </li>
            </ul>
            <p className="mb-5">
              CARF explicitly unifies change type, runtime metrics, and policy
              rules into a single automated rollback decision system—a
              combination not found in existing work.
            </p>

            {/* § Benefits */}
            <h2
              id="benefits"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.25rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              Why this matters
            </h2>
            <p className="mb-5">
              By making rollback decisions context-aware, CARF aims to make
              DevOps pipelines more reliable and self-healing, reducing
              dependence on manual operator judgment under time pressure.
            </p>
            <ul className="mb-5 pl-6 space-y-2 list-disc">
              <li>
                <strong>Reduced MTTR</strong> through faster automated
                detection and rollback execution.
              </li>
              <li>
                <strong>Fewer unnecessary rollbacks</strong> by calibrating
                sensitivity to the actual risk level of each change type.
              </li>
              <li>
                <strong>Lower operational overhead</strong> through closed
                feedback loops that alert on true anomalies, not noise.
              </li>
              <li>
                <strong>Higher deployment success rates</strong> and greater
                stability in cloud-native, high-frequency release environments.
              </li>
            </ul>

            {/* § Status */}
            <h2
              id="status"
              className="scroll-mt-24 font-['Lora',Georgia,serif] text-[1.25rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0a0a0a] mt-10 mb-3"
            >
              Current status and future work
            </h2>
            <p className="mb-5">
              CARF is a <em>proposed framework</em>. The architecture and
              decision model are fully specified; large-scale production
              evaluation is ongoing future work.
            </p>
            <p className="mb-3">Future directions include:</p>
            <ul className="mb-5 pl-6 space-y-2 list-disc">
              <li>
                <strong>ML-augmented thresholds.</strong> Replacing static
                per-change-type thresholds with a model that learns optimal
                sensitivity from historical deployment outcomes.
              </li>
              <li>
                <strong>Real CI/CD validation.</strong> End-to-end testing in
                live GitLab CI, GitHub Actions, and Argo Rollouts environments.
              </li>
              <li>
                <strong>Broader change taxonomy.</strong> Extending beyond four
                change types to handle hybrid commits and microservice-level
                dependency graphs.
              </li>
            </ul>

            {/* Link to proposed implementation */}
            <div className="mt-10 mb-10 p-6 bg-[#f7f7f7] border-l-[3px] border-[#111] rounded-[2px] font-['Inter',system-ui,sans-serif]">
              <h3 className="text-[15px] font-semibold text-[#111] mb-2">Explore the Technical Implementation Specs</h3>
              <p className="text-[13.5px] text-[#555] mb-4 leading-relaxed">
                See the full technical stack, tree-sitter AST parsing algorithms, vector formulas, change vector store schemas, and evaluation harness designs.
              </p>
              <Link
                href="/"
                className="inline-flex items-center font-['Inter',system-ui,sans-serif] text-[14px] font-medium text-[#111] no-underline border-b border-b-[#111] pb-[1px] hover:opacity-50 transition-opacity"
              >
                View Full Technical Architecture & Specs →
              </Link>
            </div>

            {/* § Citation */}
            <div id="citation" className="scroll-mt-24 pt-8 border-t border-[#e5e5e5]">
              <p className="font-['Inter',system-ui,sans-serif] text-[11px] font-semibold tracking-[0.12em] uppercase text-[#888] mb-3">
                Citation
              </p>
              <p className="mb-3 font-['Inter',system-ui,sans-serif] text-[14px] text-[#444]">
                Please cite this research paper as:
              </p>
              <pre className="bg-[#f6f6f6] border border-[#e5e5e5] p-4 font-mono text-[12.5px] leading-[1.6] text-[#444] overflow-x-auto whitespace-pre-wrap rounded-[3px]">
{`Dinesh Korukonda, Tammineni Monika, Jonnalagadda Surya Kiran, Hemachand Pallam,
"Change-Aware Automated Rollback Decision Framework for DevOps Pipelines", 2026.`}
              </pre>
            </div>

          </article>
        </div>
      </div>
    </main>
  );
}
