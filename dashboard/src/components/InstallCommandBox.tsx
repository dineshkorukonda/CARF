"use client";

import { useState } from "react";
import { Check, Copy, Box, Layers, Terminal } from "lucide-react";

export interface InstallTab {
  id: string;
  label: string;
  icon: "docker" | "compose" | "shell";
  command: string;
  caption: string;
}

const DEFAULT_TABS: InstallTab[] = [
  {
    id: "docker",
    label: "Docker (Recommended)",
    icon: "docker",
    command:
      "docker run -d --name carf-agent --restart unless-stopped -v /var/run/docker.sock:/var/run/docker.sock -e CARF_API_URL=https://carf.indevs.in ghcr.io/dineshkorukonda/carf-agent:latest",
    caption: "Runs isolated in Docker with auto-restart on reboot. Monitors local containers with zero host dependencies.",
  },
  {
    id: "compose",
    label: "Docker Compose",
    icon: "compose",
    command:
      "curl -fsSL https://carf.indevs.in/docker-compose.yml -o docker-compose.carf.yml && docker compose -f docker-compose.carf.yml up -d",
    caption: "Downloads production compose manifest with healthcheck probes and starts the agent in the background.",
  },
  {
    id: "shell",
    label: "Linux / Shell",
    icon: "shell",
    command: "curl -fsSL https://carf.indevs.in/install.sh | bash",
    caption: "Installs lightweight systemd or PM2 daemon directly on bare-metal or cloud VMs.",
  },
];

export function InstallCommandBox({
  initialTab = "docker",
}: {
  initialTab?: string;
  command?: string;
}) {
  const [activeTabId, setActiveTabId] = useState(initialTab);
  const [copied, setCopied] = useState(false);

  const activeTab = DEFAULT_TABS.find((t) => t.id === activeTabId) ?? DEFAULT_TABS[0];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(activeTab.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is blocked
    }
  }

  function getIcon(type: InstallTab["icon"]) {
    switch (type) {
      case "docker":
        return <Box className="size-3.5" />;
      case "compose":
        return <Layers className="size-3.5" />;
      case "shell":
        return <Terminal className="size-3.5" />;
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-slate-950 shadow-md">
      {/* Tab Switcher Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2 gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Installation methods">
          {DEFAULT_TABS.map((tab) => {
            const isSelected = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setCopied(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {getIcon(tab.icon)}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy install command"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 cursor-pointer shrink-0"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* Code Display Area */}
      <div className="p-4 font-mono text-xs text-slate-100 flex items-start gap-2.5 overflow-x-auto select-all bg-slate-950">
        <span className="text-slate-500 select-none pt-0.5">$</span>
        <span className="text-emerald-400 whitespace-pre-wrap break-all leading-relaxed font-mono">
          {activeTab.command}
        </span>
      </div>

      {/* Helper Caption */}
      <div className="border-t border-slate-900 bg-slate-900/40 px-4 py-2 text-[11px] text-slate-400 flex items-center justify-between">
        <span>{activeTab.caption}</span>
        <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider shrink-0 ml-2">
          {activeTab.id === "shell" ? "bash" : "docker cli"}
        </span>
      </div>
    </div>
  );
}
