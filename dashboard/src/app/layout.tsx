import { Suspense } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import { THEME_INIT_SCRIPT } from "../components/ThemeToggle";
import { TopProgressBar } from "../components/TopProgressBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "CARF Dashboard",
  description: "Connect a GitHub account, install the CARF App, and manage rollback configuration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Runs before first paint to avoid a flash of the wrong theme. next/script with
            beforeInteractive (not a raw <script>) is the supported way to inject this into
            the root layout's <head> -- see script.md's beforeInteractive section. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
