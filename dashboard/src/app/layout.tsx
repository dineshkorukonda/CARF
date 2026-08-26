import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CARF Dashboard",
  description: "Connect a GitHub account, install the CARF App, and manage rollback configuration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-white text-[#111] min-h-screen flex flex-col">
        <header className="w-full border-b border-[#eaeaea] bg-white">
          <div className="max-w-[900px] mx-auto px-6 h-14 flex items-center text-[13px]">
            <span className="font-semibold text-[#111] tracking-tight flex items-center gap-2">
              <span className="bg-[#111] text-white px-1.5 py-0.5 text-[11px] font-mono rounded-[2px] tracking-widest">
                CARF
              </span>
              <span>Dashboard</span>
            </span>
          </div>
        </header>
        <div className="flex-grow">{children}</div>
      </body>
    </html>
  );
}
