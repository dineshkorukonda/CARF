import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "../components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "CARF Dashboard",
  description: "Connect a GitHub account, install the CARF App, and manage rollback configuration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Runs before first paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
