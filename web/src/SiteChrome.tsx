import type { ReactNode } from "react";

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#ffffff] text-[#0a0a0a] flex flex-col justify-between selection:bg-[#0a0a0a] selection:text-white">
      <header className="border-b border-[#eaeaea] bg-white sticky top-0 z-40">
        <div className="max-w-[1080px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="#home" className="flex items-center gap-2.5">
            <span className="bg-[#0a0a0a] text-white px-2 py-0.5 text-[11px] font-mono font-semibold rounded-[3px] tracking-wider uppercase">
              CARF
            </span>
            <span className="font-['Inter',system-ui,sans-serif] text-[13px] font-semibold text-[#111] tracking-tight">
              Change-Aware Rollback Framework
            </span>
          </a>

          <nav className="flex items-center gap-4">
            <a
              href="#guide"
              className="font-['Inter',system-ui,sans-serif] text-[13px] font-medium text-[#666] hover:text-[#0a0a0a] transition-colors px-2 py-1"
            >
              Guide
            </a>
            <a
              href="https://carf.indevs.in/login"
              className="font-['Inter',system-ui,sans-serif] text-[13px] font-medium text-[#666] hover:text-[#0a0a0a] transition-colors px-2 py-1"
            >
              Sign In
            </a>
            <a
              href="https://carf.indevs.in/signup"
              className="font-['Inter',system-ui,sans-serif] text-[13px] font-medium bg-[#0a0a0a] hover:bg-[#262626] text-white px-3.5 py-1.5 rounded-[4px] transition-colors"
            >
              Get Started
            </a>
          </nav>
        </div>
      </header>

      {children}

      <footer className="border-t border-[#eaeaea] bg-[#ffffff] py-4">
        <div className="max-w-[1080px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] font-['Inter',system-ui,sans-serif] text-[#777]">
          <div>
            <span className="font-semibold text-[#111]">CARF</span> — Change-Aware Rollback Framework
          </div>
          <a href="#guide" className="font-mono text-[11px] text-[#999] hover:text-[#111]">
            How to use PM2, Vercel, and more
          </a>
        </div>
      </footer>
    </div>
  );
}
