"use client";

import { useState } from "react";
import Link from "next/link";
import { Terminal, Menu, X, ArrowRight, BookOpen } from "lucide-react";

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-[#08080a]/90 backdrop-blur-md">

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight text-white hover:opacity-90 transition-opacity">
          <span className="tracking-widest text-cyan-400">CARF</span>
          <span className="text-xs text-zinc-500 font-sans font-normal border-l border-zinc-800 pl-2">Rollback Engine</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
          <a href="/#problem" className="hover:text-white transition-colors">
            Problem
          </a>
          <a href="/#how-it-works" className="hover:text-white transition-colors">
            Architecture
          </a>
          <a href="/#integration" className="hover:text-white transition-colors">
            Integration
          </a>
          <a href="/#sensitivity-matrix" className="hover:text-white transition-colors">
            Sensitivity Matrix
          </a>
          <a href="/#targets" className="hover:text-white transition-colors">
            Targets
          </a>
          <Link href="/docs" className="text-cyan-400 font-mono flex items-center gap-1 hover:text-cyan-300 transition-colors">
            <BookOpen className="h-3.5 w-3.5" /> Documentation
          </Link>
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all"
          >
            <GithubIcon className="h-3.5 w-3.5" />
            <span>GitHub</span>
          </a>
          <Link
            href="/docs"
            className="flex items-center gap-1.5 rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 transition-all"
          >
            <span>View docs</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 text-zinc-400 hover:text-white"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-[#08080a] px-4 py-4 space-y-3">
          <nav className="flex flex-col space-y-2 text-sm text-zinc-300">
            <a
              href="/#problem"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-cyan-400"
            >
              Problem
            </a>
            <a
              href="/#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-cyan-400"
            >
              Architecture
            </a>
            <a
              href="/#integration"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-cyan-400"
            >
              Integration
            </a>
            <a
              href="/#sensitivity-matrix"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-cyan-400"
            >
              Sensitivity Matrix
            </a>
            <a
              href="/#targets"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-cyan-400"
            >
              Targets
            </a>
            <Link
              href="/docs"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 text-cyan-400 font-mono flex items-center gap-1"
            >
              <BookOpen className="h-4 w-4" /> Documentation
            </Link>
          </nav>
          <div className="pt-2 border-t border-zinc-800 flex flex-col gap-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex justify-center items-center gap-2 rounded border border-zinc-800 bg-zinc-900 py-2 text-xs font-mono text-zinc-300"
            >
              <GithubIcon className="h-4 w-4" />
              GitHub Repository
            </a>
            <Link
              href="/docs"
              onClick={() => setMobileMenuOpen(false)}
              className="flex justify-center items-center gap-2 rounded border border-cyan-500/40 bg-cyan-500/10 py-2 text-xs font-medium text-cyan-300"
            >
              View docs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
