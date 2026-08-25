"use client";

import Link from "next/link";
import { useState } from "react";
import { ProjectStatus } from "@/components/ProjectStatus";

const STORAGE_KEY = "carf.coreApiUrl";

const STEPS = [
  { title: "Deploy core-api", desc: "Railway, Render, Fly, or your own host — see the core-api README for the full walkthrough." },
  { title: "Create a GitHub App", desc: "Contents + Metadata + Pull requests (read-only), subscribed to push and pull_request events." },
  { title: "Install it on your repo", desc: "From the App's settings page, install it on the repo(s) CARF should monitor." },
];

type CheckResult =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "unreachable" }
  | { state: "connected"; installationCount: number; installations: { id: number; account: string }[] }
  | { state: "not-connected"; error: string };

function isValidHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function IntegratePage() {
  const [url, setUrl] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      // localStorage unavailable (privacy mode, etc.) — fine, just start blank.
      return "";
    }
  });
  const [inputError, setInputError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult>({ state: "idle" });

  async function checkConnection() {
    const trimmed = url.trim().replace(/\/$/, "");

    if (!isValidHttpsUrl(trimmed)) {
      setInputError("Enter a valid https:// URL for your core-api deployment.");
      setResult({ state: "idle" });
      return;
    }
    setInputError(null);

    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // Non-fatal — just means the URL won't be remembered next visit.
    }

    setResult({ state: "loading" });

    try {
      const response = await fetch(`${trimmed}/v1/github/status`, {
        signal: AbortSignal.timeout(8000),
      });
      const body = await response.json();

      if (body.connected) {
        setResult({ state: "connected", installationCount: body.installationCount, installations: body.installations });
      } else {
        setResult({ state: "not-connected", error: body.error });
      }
    } catch {
      setResult({ state: "unreachable" });
    }
  }

  const connected = result.state === "connected";

  return (
    <main className="bg-white min-h-screen">
      <div className="max-w-[720px] mx-auto px-6 pt-16 pb-24 font-['Inter',system-ui,sans-serif]">
        <div className="mb-4">
          <Link href="/" className="text-[13px] text-[#888] hover:opacity-60">
            ← Back
          </Link>
        </div>
        <h1 className="font-['Lora',Georgia,serif] text-[2rem] leading-[1.2] font-semibold tracking-[-0.02em] text-[#0a0a0a] mb-3">
          Connect your CARF deployment
        </h1>
        <p className="text-[15px] leading-[1.6] text-[#555] mb-10">
          Run through these steps, then confirm the connection below. Full instructions live in{" "}
          <a
            href="https://github.com/dineshkorukonda/CARF/tree/main/core-api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#111] underline underline-offset-2 hover:opacity-60"
          >
            core-api/README.md
          </a>
          .
        </p>

        <div className="space-y-2 mb-10">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex items-start gap-3 bg-[#fafafa] border border-[#eaeaea] rounded-[4px] px-3.5 py-2.5">
              <span className="shrink-0 mt-0.5 flex items-center justify-center size-5 rounded-full bg-[#eee] text-[11px] font-mono text-[#666]">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#111]">{step.title}</div>
                <div className="text-[12px] text-[#888] mt-0.5">{step.desc}</div>
              </div>
            </div>
          ))}
          <div
            className={`flex items-start gap-3 border rounded-[4px] px-3.5 py-2.5 ${
              connected ? "bg-[#f0fdf4] border-[#bbf7d0]" : "bg-[#fafafa] border-[#eaeaea]"
            }`}
          >
            <span
              className={`shrink-0 mt-0.5 flex items-center justify-center size-5 rounded-full text-[11px] font-mono ${
                connected ? "bg-[#166534] text-white" : "bg-[#eee] text-[#666]"
              }`}
            >
              {connected ? "✓" : "4"}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[#111]">Connected</div>
              <div className="text-[12px] text-[#888] mt-0.5">Confirmed by the live check below.</div>
            </div>
          </div>
        </div>

        <div className="rounded-[6px] border border-[#e5e5e5] bg-[#fafafa] p-5 mb-10">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#111] mb-3">
            Check connection
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.onrender.com"
              className="flex-1 min-w-0 text-[13px] font-mono px-3 py-2 rounded-[4px] border border-[#ddd] bg-white text-[#111] outline-none focus:border-[#999]"
            />
            <button
              onClick={checkConnection}
              disabled={result.state === "loading"}
              className="shrink-0 text-[13px] font-medium px-4 py-2 rounded-[4px] bg-[#111] text-white hover:opacity-80 disabled:opacity-50"
            >
              {result.state === "loading" ? "Checking…" : "Check connection"}
            </button>
          </div>
          {inputError && <p className="text-[12px] text-[#b91c1c] mt-1">{inputError}</p>}

          {result.state === "connected" && (
            <div className="mt-3 text-[13px] text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] rounded-[4px] px-3 py-2">
              Connected · {result.installationCount} installation{result.installationCount === 1 ? "" : "s"}
              {result.installations.length > 0 && (
                <span className="text-[#166534]/80"> — {result.installations.map((i) => i.account).join(", ")}</span>
              )}
            </div>
          )}
          {result.state === "not-connected" && (
            <div className="mt-3 text-[13px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-[4px] px-3 py-2">
              Not connected — {result.error}
            </div>
          )}
          {result.state === "unreachable" && (
            <div className="mt-3 text-[13px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-[4px] px-3 py-2">
              Couldn&apos;t reach that URL — check it&apos;s correct and the service is running.
            </div>
          )}
        </div>

        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#888] mb-3">
          CARF&apos;s own build progress
        </h2>
        <ProjectStatus />
      </div>
    </main>
  );
}
