"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Server,
  RefreshCw,
  Terminal,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import type { InstallationRepo } from "../../../adapters/github/reposClient";
import { projectPageHref } from "../../../lib/dashboardNav";

export interface Pm2App {
  name: string;
  pm_id: number;
  status: string;
  cwd?: string;
  instances?: number;
}

export interface VerificationCheckItem {
  id: string;
  title: string;
  passed: boolean;
  message?: string;
}

interface StandaloneSetupProps {
  repo: InstallationRepo;
  installationId: string;
  accountName: string;
  initialPm2?: {
    layout?: "releases" | "git";
    cwd?: string;
    healthUrl?: string;
    targetName?: string;
    releasesDir?: string;
    currentSymlink?: string;
  };
  onBackToMode: () => void;
}

export function StandaloneSetup({
  repo,
  installationId,
  accountName,
  initialPm2,
  onBackToMode,
}: StandaloneSetupProps) {
  // Sub-step: 1 = PM2 App, 2 = Install Host Agent, 3 = Review & Commit
  const [subStep, setSubStep] = useState<1 | 2 | 3>(1);

  // PM2 Configuration
  const [targetName, setTargetName] = useState<string>(initialPm2?.targetName || repo.name);
  const [layout, setLayout] = useState<"releases" | "git">(initialPm2?.layout || "git");
  const [cwd, setCwd] = useState<string>(initialPm2?.cwd || `/var/www/${repo.name}`);
  const [healthUrl, setHealthUrl] = useState<string>(
    initialPm2?.healthUrl || "http://127.0.0.1:3000/healthz"
  );
  const [releasesDir, setReleasesDir] = useState<string>(
    initialPm2?.releasesDir || `/var/www/${repo.name}/releases`
  );
  const [currentSymlink, setCurrentSymlink] = useState<string>(
    initialPm2?.currentSymlink || `/var/www/${repo.name}/current`
  );
  const [startupGraceSeconds, setStartupGraceSeconds] = useState<number>(15);

  // PM2 Discovery
  const [pm2Apps, setPm2Apps] = useState<Pm2App[]>([]);
  const [discoveringPm2, setDiscoveringPm2] = useState<boolean>(false);
  const [pm2DiscoveryError, setPm2DiscoveryError] = useState<string | null>(null);

  // Host Agent Token & Status
  const [installToken, setInstallToken] = useState<string>("");
  const [copiedInstallCmd, setCopiedInstallCmd] = useState<boolean>(false);
  const [generatingToken, setGeneratingToken] = useState<boolean>(false);
  const [agentStatus, setAgentStatus] = useState<"online" | "offline" | "never-installed" | "revoked">(
    "never-installed"
  );
  const [agentVersion, setAgentVersion] = useState<string | null>(null);
  const [agentLastHeartbeat, setAgentLastHeartbeat] = useState<string | null>(null);

  // Preflight Verification
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    checks: VerificationCheckItem[];
  } | null>(null);

  // Commit state
  const [committing, setCommitting] = useState<boolean>(false);
  const [commitSuccess, setCommitSuccess] = useState<boolean>(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const centralOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://carf.indevs.in";

  // Discover PM2 apps from host if agent is connected
  const discoverPm2 = async () => {
    setDiscoveringPm2(true);
    setPm2DiscoveryError(null);
    try {
      const res = await fetch("/api/pm2/apps");
      if (!res.ok) {
        throw new Error(`Failed to query PM2 apps (${res.status})`);
      }
      const data = (await res.json()) as { apps?: Pm2App[] };
      const apps = data.apps || [];
      setPm2Apps(apps);
      if (apps.length > 0 && !targetName) {
        setTargetName(apps[0]!.name);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not discover PM2 apps";
      setPm2DiscoveryError(
        `${msg}. You can enter the target process name manually below.`
      );
    } finally {
      setDiscoveringPm2(false);
    }
  };

  // Mint agent token for THIS specific repo
  const generateAgentToken = useCallback(async () => {
    setGeneratingToken(true);
    try {
      const res = await fetch("/api/repo/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          owner: repo.owner.login,
          repo: repo.name,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setInstallToken(data.token);
        }
      }
    } catch (err) {
      console.error("Failed to generate host agent token:", err);
    } finally {
      setGeneratingToken(false);
    }
  }, [installationId, repo.owner.login, repo.name]);

  // Poll agent heartbeat
  useEffect(() => {
    if (subStep !== 2) return;
    if (!installToken) {
      void generateAgentToken();
    }

    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/repo/agent-status?owner=${encodeURIComponent(
            repo.owner.login
          )}&repo=${encodeURIComponent(repo.name)}&installationId=${encodeURIComponent(
            installationId
          )}`
        );
        if (res.ok && active) {
          const data = await res.json();
          setAgentStatus(data.status);
          setAgentVersion(data.version);
          setAgentLastHeartbeat(data.lastHeartbeat);
        }
      } catch {
        // ignore polling errors
      }
    };

    void poll();
    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [subStep, installToken, generateAgentToken, repo.owner.login, repo.name, installationId]);

  // Run PM2 Preflight Check
  const runPreflightCheck = async () => {
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await fetch("/api/repo/connection-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          owner: repo.owner.login,
          repo: repo.name,
          target: {
            kind: "pm2",
            name: targetName.trim(),
            layout,
            cwd,
            healthUrl,
            ...(layout === "releases" ? { releasesDir, currentSymlink } : {}),
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationResult(data);
      } else {
        setVerificationResult({
          verified: false,
          checks: [
            {
              id: "api_error",
              title: "Verification Request",
              passed: false,
              message: data.error || "Preflight check failed",
            },
          ],
        });
      }
    } catch (err: unknown) {
      setVerificationResult({
        verified: false,
        checks: [
          {
            id: "conn_error",
            title: "Connection Error",
            passed: false,
            message: err instanceof Error ? err.message : "Failed to connect",
          },
        ],
      });
    } finally {
      setVerifying(false);
    }
  };

  // Commit .carf.yml and link
  const commitStandaloneLink = async () => {
    setCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch("/api/repo/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          owner: repo.owner.login,
          repo: repo.name,
          mode: "standalone",
          adapterKind: "pm2",
          adapterTarget: targetName.trim(),
          layout,
          cwd,
          healthUrl,
          startupGraceSeconds,
          ...(layout === "releases" ? { releasesDir, currentSymlink } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit .carf.yml");
      }
      setCommitSuccess(true);
    } catch (err: unknown) {
      setCommitError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  };

  const curlCommand = installToken
    ? `curl -fsSL ${centralOrigin}/install.sh | bash -s -- --token=${installToken}`
    : "Generating agent installation command...";

  return (
    <div className="space-y-6">
      {/* Substep breadcrumb */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <span>Standalone Configuration</span>
          <span>•</span>
          <span>Step {subStep} of 3</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span>{repo.full_name}</span>
        </div>
      </div>

      {/* SUBSTEP 1: PM2 APPLICATION */}
      {subStep === 1 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-bold text-foreground">Configure PM2 Target Process</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              CARF monitors this target PM2 application on your server and rolls it back if error rates exceed dynamic thresholds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Target PM2 Process Name</label>
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="e.g. my-app or production"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Matches the name in <code className="bg-muted px-1 rounded">pm2 status</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Deployment Layout</label>
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value as "releases" | "git")}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
              >
                <option value="git">git (working tree checkout)</option>
                <option value="releases">releases (symlink switch / Capistrano-style)</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                How updates are deployed on your filesystem
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">App Working Directory (CWD)</label>
              <input
                type="text"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Health Check Probe URL</label>
              <input
                type="text"
                value={healthUrl}
                onChange={(e) => setHealthUrl(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {layout === "releases" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-border bg-muted/20 p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Releases Directory</label>
                <input
                  type="text"
                  value={releasesDir}
                  onChange={(e) => setReleasesDir(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Current Symlink Path</label>
                <input
                  type="text"
                  value={currentSymlink}
                  onChange={(e) => setCurrentSymlink(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={onBackToMode}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Mode</span>
            </button>

            <button
              type="button"
              disabled={!targetName.trim() || !cwd.trim() || !healthUrl.trim()}
              onClick={() => setSubStep(2)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
            >
              <span>Next: Install Host Agent</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SUBSTEP 2: INSTALL HOST AGENT */}
      {subStep === 2 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-bold text-foreground">Install CARF Host Agent</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Run this one-line command on your deployment server hosting PM2. The agent reports health metrics and executes rollbacks.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">1-Line Installation Command</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(curlCommand);
                  setCopiedInstallCmd(true);
                  setTimeout(() => setCopiedInstallCmd(false), 2000);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                {copiedInstallCmd ? <Check className="size-3" /> : <Copy className="size-3" />}
                <span>{copiedInstallCmd ? "Copied" : "Copy Command"}</span>
              </button>
            </div>

            <div className="rounded-lg bg-slate-950 p-3 font-mono text-xs text-emerald-400 overflow-x-auto select-all">
              {curlCommand}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
              <span className="text-muted-foreground">Agent Status:</span>
              <span
                className={`font-semibold inline-flex items-center gap-1.5 ${
                  agentStatus === "online"
                    ? "text-emerald-500"
                    : agentStatus === "offline"
                    ? "text-amber-500"
                    : "text-muted-foreground"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    agentStatus === "online"
                      ? "bg-emerald-500 animate-pulse"
                      : agentStatus === "offline"
                      ? "bg-amber-500"
                      : "bg-slate-400"
                  }`}
                />
                {agentStatus === "online"
                  ? `Online (v${agentVersion ?? "latest"})`
                  : agentStatus === "offline"
                  ? "Offline"
                  : "Waiting for agent connection..."}
              </span>
            </div>
          </div>

          {/* Preflight verification */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground">Preflight Verification</h4>
                <p className="text-[11px] text-muted-foreground">
                  Verify PM2 process reachability and target layout checks before linking.
                </p>
              </div>
              <button
                type="button"
                onClick={runPreflightCheck}
                disabled={verifying}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
              >
                <RefreshCw className={`size-3.5 ${verifying ? "animate-spin" : ""}`} />
                <span>{verifying ? "Checking..." : "Run Preflight Check"}</span>
              </button>
            </div>

            {verificationResult && (
              <div className="space-y-2 pt-2">
                {verificationResult.checks.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{c.title}</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        c.passed ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {c.passed ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                      <span>{c.passed ? "Passed" : c.message || "Failed"}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setSubStep(1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to PM2 Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setSubStep(3)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              <span>Next: Review & Commit</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SUBSTEP 3: REVIEW & COMMIT */}
      {subStep === 3 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-bold text-foreground">Review & Link Repository</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              CARF will commit a <code className="bg-muted px-1 rounded font-mono">.carf.yml</code> file to{" "}
              <strong className="text-foreground">{repo.full_name}</strong> and enable Standalone rollout monitoring.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 pb-3 border-b border-border">
              <span className="text-muted-foreground">Repository:</span>
              <span className="font-semibold text-foreground font-mono">{repo.full_name}</span>

              <span className="text-muted-foreground">Deployment Mode:</span>
              <span className="font-semibold text-primary">STANDALONE (PM2)</span>

              <span className="text-muted-foreground">Target PM2 Process:</span>
              <span className="font-semibold text-foreground font-mono">{targetName}</span>

              <span className="text-muted-foreground">Deployment Layout:</span>
              <span className="font-mono text-foreground">{layout}</span>

              <span className="text-muted-foreground">App Working Dir:</span>
              <span className="font-mono text-foreground truncate">{cwd}</span>

              <span className="text-muted-foreground">Health Check Probe:</span>
              <span className="font-mono text-foreground truncate">{healthUrl}</span>
            </div>

            {commitError && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-rose-600 text-xs">
                {commitError}
              </div>
            )}

            {commitSuccess ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-center space-y-2">
                <CheckCircle2 className="size-6 text-emerald-500 mx-auto" />
                <p className="font-semibold text-foreground">Repository Successfully Linked!</p>
                <p className="text-muted-foreground text-xs">
                  .carf.yml has been committed to {repo.full_name}. Standalone rollout monitoring is active.
                </p>
                <div className="pt-2">
                  <Link
                    href={projectPageHref(repo.owner.login, repo.name)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
                  >
                    <span>Open Project Dashboard</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  disabled={committing}
                  onClick={commitStandaloneLink}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  {committing ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Committing .carf.yml to GitHub...</span>
                    </>
                  ) : (
                    <>
                      <Terminal className="size-3.5" />
                      <span>Commit .carf.yml & Link Standalone Repository</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {!commitSuccess && (
            <div className="flex items-center justify-start pt-2">
              <button
                type="button"
                onClick={() => setSubStep(2)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to Host Agent</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
