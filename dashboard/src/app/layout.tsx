import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CARF Dashboard",
  description: "Connect a GitHub account, install the CARF App, and manage rollback configuration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-white text-[#111]">
        <header className="w-full border-b bg-white">
          <div className="mx-auto flex h-14 max-w-[900px] items-center px-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium tracking-tight text-foreground">
              <span className="rounded-md bg-foreground px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-background">
                CARF
              </span>
              <span>Dashboard</span>
            </Link>
          </div>
        </header>
        <div className="flex-grow">{children}</div>
      </body>
    </html>
  );
}
