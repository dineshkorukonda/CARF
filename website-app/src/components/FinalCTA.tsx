import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";

const paperUrl =
  "https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing";

export function FinalCTA() {
  return (
    <section className="border-t border-white/10">
      <div className="bg-hatch">
        <div className="mx-auto max-w-5xl px-6 sm:px-8 py-24 sm:py-32 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#f56031] mb-6">
            Start small
          </p>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.15] max-w-3xl mx-auto">
            Start with one service. One deploy window. See what happens when rollbacks actually know
            your systems.
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-100 transition"
            >
              View docs
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <a
              href={paperUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-5 py-3 text-sm font-medium text-white hover:bg-black/70 transition"
            >
              Research paper
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          </div>
          <p className="mt-6 text-sm text-zinc-400">
            Open evaluation engine · Hosted control plane · Live decision traces
          </p>
        </div>
      </div>
    </section>
  );
}
