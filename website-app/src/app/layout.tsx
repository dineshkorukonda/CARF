import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CARF — Change-Aware Rollback Framework",
  description: "Hosted DevOps service that automatically decides when to roll back deployments based on change type (code, config, dependency, infrastructure).",
  keywords: ["rollback framework", "devops", "kubernetes rollback", "gitops", "deployment intelligence", "change classification"],
  authors: [{ name: "CARF Team" }],
  openGraph: {
    title: "CARF — Change-Aware Rollback Framework",
    description: "Rollback decisions that understand what changed. Adaptive thresholding for code, config, dependency, and infrastructure deployments.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#08080a] text-zinc-100 selection:bg-cyan-500/20 selection:text-cyan-300">
        {children}
      </body>
    </html>
  );
}
