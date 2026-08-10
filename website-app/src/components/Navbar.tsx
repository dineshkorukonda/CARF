"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function CarfMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#f56031" />
      <circle cx="11" cy="11" r="2.2" fill="#111" />
      <circle cx="21" cy="11" r="2.2" fill="#111" />
      <circle cx="11" cy="21" r="2.2" fill="#111" />
      <circle cx="21" cy="21" r="2.2" fill="#111" />
    </svg>
  );
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const paperUrl =
    "https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing";

  return (
    <div className="h-20 sm:h-24 px-4 pt-4 sm:px-6">
      <header className="pointer-events-none fixed top-4 right-4 left-4 z-50 mx-auto max-w-[90rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl bg-zinc-800/70 shadow-2xl shadow-black/30 backdrop-blur-xl"
        />
        <div className="relative flex h-14 sm:h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="pointer-events-auto flex items-center gap-2.5"
            aria-label="CARF home"
          >
            <CarfMark className="h-7 w-7" />
            <span className="text-[17px] font-semibold tracking-tight text-white">
              CARF
            </span>
          </Link>

          <nav className="pointer-events-auto hidden lg:flex items-center gap-1 text-sm text-zinc-300">
            {[
              ["Problem", "/#problem"],
              ["Architecture", "/#how-it-works"],
              ["Simulator", "/#interactive-demo"],
              ["Targets", "/#targets"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="rounded-full px-3.5 py-1.5 hover:bg-white/5 hover:text-white transition-colors"
              >
                {label}
              </a>
            ))}
            <Link
              href="/docs"
              className="rounded-full px-3.5 py-1.5 hover:bg-white/5 hover:text-white transition-colors"
            >
              Docs
            </Link>
          </nav>

          <div className="pointer-events-auto hidden md:flex items-center gap-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900/80 border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              GitHub
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-100 transition-colors"
            >
              View docs
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="pointer-events-auto md:hidden p-2 text-zinc-300 hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="pointer-events-auto md:hidden relative mt-2 rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl px-4 py-4 space-y-2">
            {[
              ["Problem", "/#problem"],
              ["Architecture", "/#how-it-works"],
              ["Simulator", "/#interactive-demo"],
              ["Targets", "/#targets"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                {label}
              </a>
            ))}
            <Link
              href="/docs"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm text-white"
            >
              Documentation
            </Link>
            <a
              href={paperUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl px-3 py-2 text-sm text-[#f56031]"
            >
              Research Paper
            </a>
          </div>
        )}
      </header>
    </div>
  );
}
