import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CARF — Change-Aware Rollback Framework",
  description:
    "A framework that links what changed in a deployment with how the system behaves to decide when to rollback automatically.",
  authors: [{ name: "CARF Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-white text-[#111] min-h-screen flex flex-col font-['Lora',Georgia,serif]">
        {/* Global Minimalist Top Header (Thinking Machines style) */}
        <header className="w-full border-b border-[#eaeaea] bg-white sticky top-0 z-50">
          <div className="max-w-[1060px] mx-auto px-6 h-14 flex items-center justify-between font-['Inter',system-ui,sans-serif] text-[13px]">
            <Link href="/" className="font-semibold text-[#111] tracking-tight hover:opacity-75 transition-opacity flex items-center gap-2">
              <span className="bg-[#111] text-white px-1.5 py-0.5 text-[11px] font-mono rounded-[2px] tracking-widest">CARF</span>
              <span>Change-Aware Rollback Framework</span>
            </Link>
            <nav className="flex items-center gap-6 text-[#666]">
              <Link href="/" className="hover:text-[#111] transition-colors font-medium text-[#111]">
                Proposed Architecture
              </Link>
              <Link href="/paper" className="hover:text-[#111] transition-colors">
                Conference Paper
              </Link>
              <a
                href="https://github.com/dineshkorukonda/CARF"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#111] transition-colors flex items-center gap-1"
              >
                GitHub
                <svg className="w-3 h-3 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </nav>
          </div>
        </header>

        <div className="flex-grow">{children}</div>

        {/* Global Footer */}
        <footer className="border-t border-[#eaeaea] bg-[#fafafa] py-10 mt-20 font-['Inter',system-ui,sans-serif] text-[13px] text-[#666]">
          <div className="max-w-[1060px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <span className="font-medium text-[#111]">CARF</span> — Change-Aware Automated Rollback Framework
            </div>
            <div className="flex items-center gap-6">
              <Link href="/" className="hover:text-[#111] transition-colors">Architecture & Specs</Link>
              <Link href="/paper" className="hover:text-[#111] transition-colors">Conference Paper</Link>
              <a href="https://github.com/dineshkorukonda/CARF" target="_blank" rel="noopener noreferrer" className="hover:text-[#111] transition-colors">Repository</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
