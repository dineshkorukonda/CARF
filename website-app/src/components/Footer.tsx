import Link from "next/link";
import { BookOpen, ExternalLink, Mail } from "lucide-react";

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

function CarfMark({ className = "h-6 w-6" }: { className?: string }) {
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

export function Footer() {
  const paperUrl =
    "https://drive.google.com/file/d/1ysqh2ieadw9oUXr5TnuYMI3ajxRIQz60/view?usp=sharing";

  return (
    <footer className="border-t border-white/10 bg-black text-sm text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-8 border-b border-white/10">
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2.5 text-white">
              <CarfMark />
              <span className="text-base font-semibold tracking-tight">CARF</span>
            </Link>
            <p className="text-sm text-zinc-500 max-w-md leading-relaxed">
              Change-aware rollback intelligence for Kubernetes, PM2, Docker, and GitOps pipelines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/docs"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-100"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Docs
            </Link>
            <a
              href={paperUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 hover:bg-white/10"
            >
              Research paper
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 hover:bg-white/10"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              GitHub
            </a>
            <a
              href="mailto:support@carf.dev"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 hover:bg-white/10"
            >
              <Mail className="h-3.5 w-3.5" />
              Contact
            </a>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#58de54] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#58de54]" />
            </span>
            <span>All control planes operational</span>
          </div>
          <div>© {new Date().getFullYear()} CARF · Change-Aware Rollback Framework</div>
        </div>
      </div>
    </footer>
  );
}
