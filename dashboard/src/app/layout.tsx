import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CARF Dashboard",
  description: "Connect a GitHub account, install the CARF App, and manage rollback configuration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
