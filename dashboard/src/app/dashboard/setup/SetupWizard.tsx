"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Terminal,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  Play,
  FileCode,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { InstallationRepo } from "../../../adapters/github/reposClient";

interface InstallationDef {
  id: string;
  installationId: string;
  accountLogin?: string | null;
}

interface VerificationCheckItem {
  id: string;
  title: string;
  passed: boolean;
  message: string;
}

interface Pm2App {
  name: string;
  status: string;
  restarts: number;
  uptime: number;
  cwd?: string;
}

interface RepoConnectionDef {
  id: string;
  installationId: string;
  owner: string;
  repo: string;
  verifiedAt: Date | string | null;
  monitoringPaused: boolean;
}

interface SetupWizardProps {
  installations: InstallationDef[];
  initialRepos: InstallationRepo[];
  connections: RepoConnectionDef[];
  initialRepoFullName?: string;
}

export function SetupWizard({
  installations,
  initialRepos,
  connections,
  initialRepoFullName = "",
}: SetupWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(initialRepoFullName ? 2 : 1);
  const [selectedInstallationId, setSelectedInstallationId] = useState<string>(
    installations[0]?.installationId || ""
  );

  // Step 1: Repo selection
  const repos = initialRepos;
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>(
    initialRepoFullName || initialRepos[0]?.full_name || ""
  );

  // Step 2: PM2 discovery
  const [pm2Apps, setPm2Apps] = useState<Pm2App[]>([]);
  const [loadingPm2, setLoadingPm2] = useState<boolean>(false);
  const [pm2Error, setPm2Error] = useState<string | null>(null);
  const [selectedTargetName, setSelectedTargetName] = useState<string>("");

  // Step 3: Target configuration
  const [layout, setLayout] = useState<"releases" | "git">("releases");
  const [healthUrl, setHealthUrl] = useState<string>("http://127.0.0.1:3000/healthz");
  const [startupGraceSeconds, setStartupGraceSeconds] = useState<number>(15);
  const [cwd, setCwd] = useState<string>("/var/www/app");
  const [releasesDir, setReleasesDir] = useState<string>("/var/www/releases");
  const [currentSymlink, setCurrentSymlink] = useState<string>("/var/www/current");
  const [sharedDirs, setSharedDirs] = useState<string>("/var/www/shared/node_modules");

  // Step 4: Verification
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    checks: VerificationCheckItem[];
    layout?: "git" | "releases";
  } | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Step 5: Save/commit
  const [copiedYaml, setCopiedYaml] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);
  const [commitSuccess, setCommitSuccess] = useState<boolean>(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const selectedRepo = repos.find((r) => r.full_name === selectedRepoFullName);
  const selectedConnection = connections.find(
    (c) =>
      c.owner.toLowerCase() === selectedRepo?.owner.login.toLowerCase() &&
      c.repo.toLowerCase() === selectedRepo?.name.toLowerCase()
  );

  // Fetch PM2 apps when entering step 2 or on manual refresh
  const fetchPm2Apps = useCallback(async () => {
    if (!selectedInstallationId) return;
    setLoadingPm2(true);
    setPm2Error(null);
    try {
      const res = await fetch(`/api/pm2/apps?installationId=${selectedInstallationId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPm2Apps(data.apps || []);
      if (data.apps && data.apps.length > 0 && !selectedTargetName) {
        setSelectedTargetName(data.apps[0].name);
        if (data.apps[0].cwd) {
          setCwd(data.apps[0].cwd);
          setReleasesDir(`${data.apps[0].cwd}/releases`);
          setCurrentSymlink(`${data.apps[0].cwd}/current`);
        }
      }
    } catch (err: unknown) {
      setPm2Error(err instanceof Error ? err.message : "Failed to load PM2 apps from core API");
    } finally {
      setLoadingPm2(false);
    }
  }, [selectedInstallationId, selectedTargetName]);

  useEffect(() => {
    if (currentStep === 2 && pm2Apps.length === 0) {
      queueMicrotask(() => {
        void fetchPm2Apps();
      });
    }
  }, [currentStep, pm2Apps.length, fetchPm2Apps]);

  // Run 5-item verification
  const runVerification = async () => {
    if (!selectedRepo) return;
    setVerifying(true);
    setVerificationError(null);
    try {
      const sharedList = sharedDirs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        installationId: selectedInstallationId,
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        target: {
          name: selectedTargetName,
          healthUrl,
          startupGraceSeconds,
          layout,
          cwd: layout === "git" ? cwd : undefined,
          releasesDir: layout === "releases" ? releasesDir : undefined,
          currentSymlink: layout === "releases" ? currentSymlink : undefined,
          sharedDirs: layout === "releases" ? sharedList : undefined,
          sharedPaths: layout === "releases" ? sharedList : undefined,
        },
      };

      const res = await fetch("/api/repo/connection-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setVerificationResult(data);
    } catch (err: unknown) {
      setVerificationError(err instanceof Error ? err.message : "Verification request failed");
    } finally {
      setVerifying(false);
    }
  };

  // Generate .carf.yml
  const generateYaml = () => {
    const sharedList = sharedDirs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let yml = `mode: standalone\nadapter:\n  kind: pm2\n  target: "${selectedTargetName || "app"}"\n  layout: ${layout}\n  healthUrl: "${healthUrl}"\n  startupGraceSeconds: ${startupGraceSeconds}\n`;

    if (layout === "releases") {
      yml += `  releasesRoot: "${releasesDir}"\n  currentSymlink: "${currentSymlink}"\n`;
      if (sharedList.length > 0) {
        yml += `  sharedPaths:\n`;
        sharedList.forEach((dir) => {
          yml += `    - "${dir}"\n`;
        });
      }
    } else {
      yml += `  cwd: "${cwd}"\n`;
    }

    return yml;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateYaml());
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  const commitToRepo = async () => {
    if (!selectedRepo) return;
    setCommitting(true);
    setCommitError(null);
    setCommitSuccess(false);

    try {
      const sharedList = sharedDirs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/repo/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId: selectedInstallationId,
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          mode: "standalone",
          adapterKind: "pm2",
          adapterTarget: selectedTargetName,
          layout,
          healthUrl,
          startupGraceSeconds,
          ...(layout === "git" ? { cwd } : {}),
          ...(layout === "releases"
            ? {
                releasesRoot: releasesDir,
                currentSymlink,
                sharedPaths: sharedList,
              }
            : {}),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(
            `Failed to commit .carf.yml (HTTP ${res.status}). Pull, rebuild, and restart carf-dashboard so /api/repo/link is live.`
          );
        }
        throw new Error(data.error || `Failed to commit .carf.yml (HTTP ${res.status})`);
      }

      setCommitSuccess(true);
      router.push(`/dashboard/repos/${selectedRepo.owner.login}/${selectedRepo.name}`);
    } catch (err: unknown) {
      setCommitError(err instanceof Error ? err.message : "Failed to commit .carf.yml");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <div className="flex items-center gap-2">
          <Terminal className="size-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">PM2 Onboarding & Connection Check</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect your GitHub repository to a live PM2 process on the host, verify filesystem and probe preconditions, and generate `.carf.yml`.
        </p>
      </div>

      {/* Progress Steps Header */}
      <div className="my-6 grid grid-cols-5 gap-2 text-center text-xs">
        {[
          { step: 1, label: "1. Repository" },
          { step: 2, label: "2. PM2 App" },
          { step: 3, label: "3. Layout & Probe" },
          { step: 4, label: "4. Verification" },
          { step: 5, label: "5. .carf.yml" },
        ].map((item) => (
          <button
            key={item.step}
            type="button"
            onClick={() => setCurrentStep(item.step as 1 | 2 | 3 | 4 | 5)}
            className={`rounded-lg border px-3 py-2 font-medium transition-colors ${
              currentStep === item.step
                ? "border-primary bg-primary/10 text-primary"
                : currentStep > item.step
                ? "border-border bg-card text-foreground"
                : "border-border/40 bg-muted/20 text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        {/* Step 1: Select Repository */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Step 1: Select Repository</h2>
            <p className="text-xs text-muted-foreground">
              Choose the repository from your GitHub App installation to link with PM2 rollback monitoring.
            </p>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Installation</label>
                  <a
                    href="/dashboard/settings"
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span>Paste installation ID or manage apps</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                <select
                  value={selectedInstallationId}
                  onChange={(e) => setSelectedInstallationId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {installations.map((inst) => (
                    <option key={inst.installationId} value={inst.installationId}>
                      {inst.accountLogin ? `${inst.accountLogin} (ID: ${inst.installationId})` : `Installation #${inst.installationId}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Repository</label>
                <select
                  value={selectedRepoFullName}
                  onChange={(e) => setSelectedRepoFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.full_name}>
                      {repo.full_name} ({repo.default_branch})
                    </option>
                  ))}
                </select>
              </div>

              {selectedConnection && (
                <div className="mt-4 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs">
                  <span className="font-semibold text-foreground">Current Connection Status:</span>
                  <div className="mt-1 flex items-center gap-2">
                    {selectedConnection.verifiedAt ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3.5" />
                        Verified on {new Date(selectedConnection.verifiedAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                        <AlertTriangle className="size-3.5" />
                        Not verified
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <span>Continue to PM2 Selection</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: PM2 Discovery */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Step 2: Select PM2 Process Target</h2>
                <p className="text-xs text-muted-foreground">
                  Processes discovered directly from the host machine running core-api via read-only PM2 inspection.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchPm2Apps}
                disabled={loadingPm2}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted"
              >
                <RefreshCw className={`size-3 ${loadingPm2 ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingPm2 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : pm2Error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                <p className="font-semibold">Failed to query host PM2:</p>
                <p className="mt-0.5">{pm2Error}</p>
                <div className="mt-3">
                  <label className="text-xs font-medium text-foreground">Or enter target process name manually:</label>
                  <input
                    type="text"
                    value={selectedTargetName}
                    onChange={(e) => setSelectedTargetName(e.target.value)}
                    placeholder="my-pm2-app"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                  />
                </div>
              </div>
            ) : pm2Apps.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <p>No active PM2 processes found on host.</p>
                <div className="mt-3 max-w-sm mx-auto">
                  <input
                    type="text"
                    value={selectedTargetName}
                    onChange={(e) => setSelectedTargetName(e.target.value)}
                    placeholder="Enter PM2 app name manually"
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                  />
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {pm2Apps.map((app) => (
                  <label
                    key={app.name}
                    className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                      selectedTargetName === app.name ? "bg-primary/10" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="pm2Target"
                        value={app.name}
                        checked={selectedTargetName === app.name}
                        onChange={() => {
                          setSelectedTargetName(app.name);
                          if (app.cwd) {
                            setCwd(app.cwd);
                            setReleasesDir(`${app.cwd}/releases`);
                            setCurrentSymlink(`${app.cwd}/current`);
                          }
                        }}
                        className="text-primary"
                      />
                      <div>
                        <span className="font-mono font-semibold text-xs text-foreground">{app.name}</span>
                        <div className="mt-0.5 text-[11px] text-muted-foreground font-mono">
                          {app.cwd || "cwd not reported"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          app.status === "online"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {app.status}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {app.restarts} restarts
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="rounded-lg border border-border px-4 py-2 text-xs text-foreground hover:bg-muted"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                disabled={!selectedTargetName}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <span>Continue to Layout & Probe</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Layout & Probe Configuration */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Step 3: Configure Layout & Health Probe</h2>
            <p className="text-xs text-muted-foreground">
              Define the filesystem deployment strategy and HTTP probe endpoint used during rollout health observation.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground">Deployment Layout Strategy</label>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLayout("releases")}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      layout === "releases"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <span className="block text-xs font-semibold text-foreground">Releases (Symlink)</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Atomic symlink pointing to release directories. Zero-downtime rollback.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayout("git")}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      layout === "git"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <span className="block text-xs font-semibold text-foreground">Git Checkout</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      In-place repository checkout with git reset to prior commit SHA.
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Health Check Probe URL</label>
                <input
                  type="text"
                  value={healthUrl}
                  onChange={(e) => setHealthUrl(e.target.value)}
                  placeholder="http://127.0.0.1:3000/healthz"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Must respond with HTTP 2xx when the target process is healthy.
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Startup Grace Period (seconds)</label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={startupGraceSeconds}
                  onChange={(e) => setStartupGraceSeconds(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Delay before evaluating error rates post-reload.
                </span>
              </div>

              {layout === "releases" ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-foreground">Releases Root Directory</label>
                    <input
                      type="text"
                      value={releasesDir}
                      onChange={(e) => setReleasesDir(e.target.value)}
                      placeholder="/var/www/releases"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">Current Active Symlink Path</label>
                    <input
                      type="text"
                      value={currentSymlink}
                      onChange={(e) => setCurrentSymlink(e.target.value)}
                      placeholder="/var/www/current"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">Shared Directories (comma-separated)</label>
                    <input
                      type="text"
                      value={sharedDirs}
                      onChange={(e) => setSharedDirs(e.target.value)}
                      placeholder="/var/www/shared/node_modules, /var/www/shared/.env"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs font-medium text-foreground">Working Directory (cwd)</label>
                  <input
                    type="text"
                    value={cwd}
                    onChange={(e) => setCwd(e.target.value)}
                    placeholder="/var/www/app"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="rounded-lg border border-border px-4 py-2 text-xs text-foreground hover:bg-muted"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <span>Continue to Verification Check</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Connection Verification */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Step 4: Execute Preflight Connection Verification</h2>
                <p className="text-xs text-muted-foreground">
                  Validates PM2, the target process, the HTTP probe, and layout-specific paths ({layout === "git" ? "working directory and .git" : "releases directory, current symlink, and shared paths"}).
                </p>
              </div>
              <button
                type="button"
                onClick={runVerification}
                disabled={verifying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {verifying ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                <span>{verifying ? "Checking..." : "Run Connection Check"}</span>
              </button>
            </div>

            {verificationError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                <p className="font-semibold">Verification check request failed:</p>
                <p className="mt-0.5">{verificationError}</p>
              </div>
            )}

            {verificationResult && (
              <div className="space-y-3">
                <div
                  className={`rounded-lg border p-3 text-xs flex items-center justify-between ${
                    verificationResult.verified
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {verificationResult.verified ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <XCircle className="size-4" />
                    )}
                    <span>
                      {verificationResult.verified
                        ? `Verification Successful: All ${verificationResult.checks.length} checks passed. Repository marked verified.`
                        : "Verification Failed: Resolve failing checks before activating rollbacks."}
                    </span>
                  </div>
                </div>

                {layout === "git" &&
                  verificationResult.checks.some(
                    (c) => c.id === "releases_dir" || c.id === "current_symlink"
                  ) && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                      <p className="font-semibold">core-api ran Capistrano releases checks on a git layout.</p>
                      <p className="mt-0.5">
                        Pull latest <code className="font-mono">main</code> and restart{" "}
                        <code className="font-mono">carf-core-api</code>, then run this check again. The dashboard
                        already selected git; the API process is still on the old verify path.
                      </p>
                    </div>
                  )}

                <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {verificationResult.checks.map((c) => (
                    <div key={c.id} className="p-3 text-xs flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        {c.passed ? (
                          <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-semibold text-foreground">{c.title}</span>
                          <p className="mt-0.5 text-muted-foreground">{c.message}</p>
                        </div>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-mono uppercase font-semibold ${
                          c.passed
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {c.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!verificationResult && !verifying && (
              <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                Click &quot;Run Connection Check&quot; to test PM2, the process table, the HTTP probe, and {layout === "git" ? "the git working directory" : "releases directory, symlink, and shared paths"}.
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="rounded-lg border border-border px-4 py-2 text-xs text-foreground hover:bg-muted"
              >
                Back
              </button>
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  disabled={!verificationResult?.verified}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <span>Continue to .carf.yml Setup</span>
                  <ArrowRight className="size-3.5" />
                </button>
                {!verificationResult?.verified && (
                  <p className="text-[11px] text-muted-foreground">
                    All connection checks must pass before the repo is marked verified.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: .carf.yml Generation and Direct Commit */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Step 5: Generate & Commit `.carf.yml`</h2>
            <p className="text-xs text-muted-foreground">
              Commit `.carf.yml` to the root of your repository. When present, `.carf.yml` in the repository root takes strict precedence over stored database configuration.
            </p>

            <div className="relative">
              <pre className="rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs text-foreground overflow-x-auto">
                {generateYaml()}
              </pre>
              <button
                type="button"
                onClick={copyToClipboard}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground shadow-xs hover:bg-muted"
              >
                {copiedYaml ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                <span>{copiedYaml ? "Copied" : "Copy YAML"}</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={commitToRepo}
                  disabled={committing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {committing ? <Loader2 className="size-3.5 animate-spin" /> : <FileCode className="size-3.5" />}
                  <span>{committing ? "Committing..." : "Commit .carf.yml to Repo"}</span>
                </button>
              </div>

              {commitSuccess && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4" />
                    <span>`.carf.yml` successfully committed to repository default branch.</span>
                  </div>
                </div>
              )}

              {commitError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                  <p className="font-semibold">Failed to commit `.carf.yml`:</p>
                  <p className="mt-0.5">{commitError}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="rounded-lg border border-border px-4 py-2 text-xs text-foreground hover:bg-muted"
              >
                Back
              </button>
              <a
                href={
                  selectedRepo
                    ? `/dashboard/repos/${selectedRepo.owner.login}/${selectedRepo.name}`
                    : "/dashboard"
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <span>Open project</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
