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
  description:
    "Rollback decisions that understand what changed. Adaptive thresholding for code, config, dependency, and infrastructure deployments.",
  keywords: [
    "rollback framework",
    "devops",
    "kubernetes rollback",
    "gitops",
    "deployment intelligence",
    "change classification",
  ],
  authors: [{ name: "CARF Team" }],
  openGraph: {
    title: "CARF — Change-Aware Rollback Framework",
    description:
      "Rollback decisions that understand what changed. Adaptive thresholding for code, config, dependency, and infrastructure deployments.",
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
      <body className="min-h-full flex flex-col bg-black text-white selection:bg-[#f56031]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
