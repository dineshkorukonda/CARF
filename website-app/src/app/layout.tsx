import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const description =
  "CARF classifies every commit diff through a two-tier engine — path/manifest rules, then Tree-sitter AST structural diffing — and turns that into a dynamic per-type error threshold fed to Argo Rollouts or Flagger in real time.";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "CARF — Change-Aware Rollback Framework",
  description,
  authors: [{ name: "CARF Team" }],
  openGraph: {
    title: "CARF — Change-Aware Rollback Framework",
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CARF — Change-Aware Rollback Framework",
    description,
  },
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
              <Link href="/docs" className="hover:text-[#111] transition-colors">
                Docs
              </Link>
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
