import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Change-Aware Automated Rollback Decisions for DevOps Pipelines",
  description:
    "A framework that links what changed in a deployment with how the system behaves to decide when to rollback automatically.",
  authors: [{ name: "CARF Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-white text-[#111] min-h-screen">{children}</body>
    </html>
  );
}
