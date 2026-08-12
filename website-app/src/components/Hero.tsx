"use client";

import Link from "next/link";
import { ArrowUpRight, ExternalLink, FileText } from "lucide-react";

const paperUrl =
  "https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing";

function StarburstGraphic() {
  const labels = [
    { text: "classify", angle: -28, dist: 38 },
    { text: "persist", angle: 18, dist: 42 },
    { text: "evaluate", angle: 118, dist: 40 },
    { text: "delegate", angle: 210, dist: 44 },
  ];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      <div className="absolute inset-[8%] rounded-full bg-hatch opacity-60" />
      <div className="absolute inset-0 ray-spin">
        <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i * 10 * Math.PI) / 180;
            const x2 = 200 + Math.cos(angle) * 180;
            const y2 = 200 + Math.sin(angle) * 180;
            const hatched = i % 3 === 0;
            return (
              <line
                key={i}
                x1="200"
                y1="200"
                x2={x2}
                y2={y2}
                stroke={hatched ? "#4a4a4a" : "#2e2e2e"}
                strokeWidth={hatched ? 2.5 : 1.5}
                strokeDasharray={hatched ? "4 3" : undefined}
              />
            );
          })}
          <circle cx="200" cy="200" r="14" fill="#1a1a1a" stroke="#3f3f46" strokeWidth="2" />
          <circle cx="200" cy="200" r="4" fill="#f56031" />
        </svg>
      </div>

      {labels.map((label) => {
        const rad = (label.angle * Math.PI) / 180;
        const x = 50 + Math.cos(rad) * label.dist;
        const y = 50 + Math.sin(rad) * label.dist;
        return (
          <div
            key={label.text}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f56031] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-black shadow-lg shadow-black/40">
              <span className="h-1.5 w-1.5 rounded-full bg-black/70" />
              {label.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Announcement bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-2">
        <a
          href={paperUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-none sm:rounded-md bg-[#f56031] px-4 py-2.5 text-sm font-medium text-black hover:brightness-110 transition"
        >
          <FileText className="h-4 w-4" />
          <span>
            Read the conference paper: Change-aware rollback decisions for production systems
          </span>
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-10 sm:pt-20 sm:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <p className="font-mono text-sm sm:text-base tracking-[-0.02em] uppercase text-[#f56031]">
                Battle-tested research. Yours to run.
              </p>
              <h1 className="font-mono text-2xl sm:text-3xl lg:text-[2rem] leading-[1.35] tracking-tight text-white uppercase">
                Rollback decisions that understand{" "}
                <span className="relative inline-block">
                  what changed
                  <span className="caret-blink ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[0.12em] align-baseline bg-[#f56031]" />
                </span>
              </h1>
              <p className="max-w-md text-base leading-7 text-neutral-400">
                CARF classifies every deploy by change type — code, config, dependency, or
                infrastructure — then provides adaptive sensitivity thresholds to Argo Rollouts or Flagger.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-100 transition"
              >
                View docs
              </Link>
              <a
                href={paperUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10 transition"
              >
                Conference paper
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-7">
            <StarburstGraphic />
          </div>
        </div>

        <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-t border-white/10 pt-8">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-200 px-4 py-1.5 text-xs font-semibold text-black">
              CARF
            </span>
            <span className="rounded-full bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-300 border border-white/10">
              Webhook Sidecar
            </span>
          </div>
          <p className="max-w-md text-sm leading-6 text-neutral-400 sm:text-right">
            Tap into change-aware rollback intelligence. Run the CARF sidecar locally and connect it to Argo Rollouts or Flagger.
          </p>
        </div>
      </div>
    </section>
  );
}
