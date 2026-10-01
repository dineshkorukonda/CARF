"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function InstallCommandBox({
  command = "curl -fsSL https://carf.indevs.in/install.sh | bash",
}: {
  command?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is blocked
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-slate-950 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-slate-700" />
            <span className="size-2 rounded-full bg-slate-700" />
            <span className="size-2 rounded-full bg-slate-700" />
          </div>
          <span className="text-[11px] font-mono text-slate-400 pl-1">bash</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy install command"
          className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 transition-colors hover:bg-slate-700 cursor-pointer"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className="p-4 font-mono text-xs text-slate-100 flex items-center gap-2 overflow-x-auto select-all">
        <span className="text-slate-500 select-none">$</span>
        <span className="text-emerald-400 whitespace-nowrap">{command}</span>
      </div>
    </div>
  );
}
