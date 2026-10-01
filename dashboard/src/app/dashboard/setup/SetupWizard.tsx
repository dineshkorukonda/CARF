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
  ShieldCheck,
  Server,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { InstallationRepo } from "../../../adapters/github/reposClient";
import { findRepoConnection, isCarfHostProcess, pm2FieldsFromStoredConfig, pickPm2App } from "../../../lib/connectionLookup";
import { projectPageHref } from "../../../lib/dashboardNav";

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
  storedConfig?: unknown;
  installTokenPrefix?: string | null;
  agentLastHeartbeat?: Date | string | null;
  agentRevoked?: boolean | null;
  agentVersion?: string | null;
  verificationReport?: unknown;
}

interface SetupWizardProps {
  installations: InstallationDef[];
  initialRepos: InstallationRepo[];
  connections: RepoConnectionDef[];
  initialRepoFullName?: string;
}

function storedPm2Seed(connections: RepoConnectionDef[], repoFullName: string) {
  const fields = pm2FieldsFromStoredConfig(findRepoConnection(connections, repoFullName)?.storedConfig);
  if (fields.targetName && isCarfHostProcess(fields.targetName)) return {};
  return fields;
}

export function SetupWizard({
  installations,
  initialRepos,
  connections,
  initialRepoFullName = "",
}: SetupWizardProps) {
  const router = useRouter();
  const seedRepo = initialRepoFullName || initialRepos[0]?.full_name || "";
  const initialPm2 = storedPm2Seed(connections, seedRepo);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(initialRepoFullName ? 2 : 1);
  const [selectedInstallationId, setSelectedInstallationId] = useState<string>(
    installations[0]?.installationId || ""
  );

  // Step 1: Repo selection
  const repos = initialRepos;
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>(seedRepo);

  // Step 2: PM2 discovery
  const [pm2Apps, setPm2Apps] = useState<Pm2App[]>([]);
  const [loadingPm2, setLoadingPm2] = useState<boolean>(false);
  const [pm2Error, setPm2Error] = useState<string | null>(null);
  const [selectedTargetName, setSelectedTargetName] = useState<string>(initialPm2.targetName ?? "");

  // Step 3: Target configuration
  const [layout, setLayout] = useState<"releases" | "git">(initialPm2.layout ?? "releases");
  const [healthUrl, setHealthUrl] = useState<string>(initialPm2.healthUrl ?? "http://127.0.0.1:3000/healthz");
  const [startupGraceSeconds, setStartupGraceSeconds] = useState<number>(15);
  const [cwd, setCwd] = useState<string>(initialPm2.cwd ?? "/var/www/app");
  const [releasesDir, setReleasesDir] = useState<string>(initialPm2.releasesDir ?? "/var/www/releases");
  const [currentSymlink, setCurrentSymlink] = useState<string>(initialPm2.currentSymlink ?? "/var/www/current");
  const [sharedDirs, setSharedDirs] = useState<string>("/var/www/shared/node_modules");

  // Step 4: Agent Install & Verification
  const [installToken, setInstallToken] = useState<string>("");
  const [copiedInstallCmd, setCopiedInstallCmd] = useState<boolean>(false);
  const [generatingToken, setGeneratingToken] = useState<boolean>(false);
  const [agentStatus, setAgentStatus] = useState<"online" | "offline" | "never-installed" | "revoked">("never-installed");
  const [agentVersion, setAgentVersion] = useState<string | null>(null);
  const [agentLastHeartbeat, setAgentLastHeartbeat] = useState<string | null>(null);

  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    checks: VerificationCheckItem[];
    layout?: "git" | "releases";
    staleCoreApi?: boolean;
  } | null>(null);

  // Step 5: Save/commit
  const [copiedYaml, setCopiedYaml] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);
  const [commitSuccess, setCommitSuccess] = useState<boolean>(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const selectedRepo = repos.find((r) => r.full_name === selectedRepoFullName);
  const selectedConnection = findRepoConnection(connections, selectedRepoFullName);

  const applyStoredPm2Fields = (stored: unknown) => {
    const next = pm2FieldsFromStoredConfig(stored);
    if (next.targetName && isCarfHostProcess(next.targetName)) return;
    if (next.layout) setLayout(next.layout);
    if (next.cwd) setCwd(next.cwd);
    if (next.healthUrl) setHealthUrl(next.healthUrl);
    if (next.targetName) setSelectedTargetName(next.targetName);
    if (next.releasesDir) setReleasesDir(next.releasesDir);
    if (next.currentSymlink) setCurrentSymlink(next.currentSymlink);
  };

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
      const apps = (data.apps || []) as Pm2App[];
      setPm2Apps(apps);
      const stored = pm2FieldsFromStoredConfig(selectedConnection?.storedConfig);
      const picked = pickPm2App(apps, {
        repoName: selectedRepo?.name ?? "",
        storedName: stored.targetName,
      });
      if (picked) {
        setSelectedTargetName(picked.name);
        const useStoredCwd =
          Boolean(stored.cwd) && stored.targetName && !stored.targetName.toLowerCase().startsWith("carf-");
        const nextCwd = useStoredCwd ? stored.cwd! : picked.cwd;
        if (nextCwd) {
          setCwd(nextCwd);
          setReleasesDir(`${nextCwd}/releases`);
          setCurrentSymlink(`${nextCwd}/current`);
        }
        if (stored.layout) setLayout(stored.layout);
        if (stored.healthUrl && useStoredCwd) setHealthUrl(stored.healthUrl);
      }
    } catch (err: unknown) {
      setPm2Error(err instanceof Error ? err.message : "Failed to load PM2 apps from core API");
    } finally {
      setLoadingPm2(false);
    }
  }, [selectedInstallationId, selectedRepo, selectedConnection]);

  useEffect(() => {
    if ((currentStep === 2 || currentStep === 4) && pm2Apps.length === 0) {
      queueMicrotask(() => {
        void fetchPm2Apps();
      });
    }
  }, [currentStep, pm2Apps.length, fetchPm2Apps]);

  // Complete Step 3: commit .carf.yml and generate installToken
  const completeStep3AndProceed = async () => {
    if (!selectedRepo) return;
    setCommitting(true);
    setCommitError(null);

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

      const data = (await res.json().catch(() => ({}))) as { error?: string; installToken?: string };
      if (!res.ok) {
        throw new Error(data.error || `Failed to commit .carf.yml (HTTP ${res.status})`);
      }

      if (data.installToken) {
        setInstallToken(data.installToken);
      }
      setCommitSuccess(true);
      setCurrentStep(4);
    } catch (err: unknown) {
      setCommitError(err instanceof Error ? err.message : "Failed to link repository");
    } finally {
      setCommitting(false);
    }
  };

  // Ensure install token in Step 4
  const ensureInstallToken = useCallback(async () => {
    if (installToken || !selectedRepo) return;
    setGeneratingToken(true);
    try {
      const res = await fetch("/api/repo/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId: selectedInstallationId,
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setInstallToken(data.token);
        }
      }
    } catch {
      // non-blocking
    } finally {
      setGeneratingToken(false);
    }
  }, [installToken, selectedRepo, selectedInstallationId]);

  // Step 4: Poll agent status & heartbeat checks every 3s
  useEffect(() => {
    if (currentStep !== 4 || !selectedRepo) return;

    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!installToken) {
      timer = setTimeout(() => {
        if (isMounted) {
          void ensureInstallToken();
        }
      }, 0);
    }
    const pollStatus = async () => {
      try {
        const res = await fetch(
          `/api/repo/agent-status?installationId=${selectedInstallationId}&owner=${selectedRepo.owner.login}&repo=${selectedRepo.name}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if (data.agentStatus) setAgentStatus(data.agentStatus);
        if (data.agentVersion) setAgentVersion(data.agentVersion);
        if (data.agentLastHeartbeat) setAgentLastHeartbeat(data.agentLastHeartbeat);

        if (Array.isArray(data.verificationReport) && data.verificationReport.length > 0) {
          setVerificationResult({
            verified: Boolean(data.verifiedAt),
            checks: data.verificationReport,
            layout,
          });
        }
      } catch {
        // silent polling catch
      }
    };

    void pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
    };
  }, [currentStep, selectedRepo, selectedInstallationId, layout, installToken, ensureInstallToken]);

  // Run manual verification check
  const runVerification = async () => {
    if (!selectedRepo) return;
    setVerifying(true);
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
    } catch {
      // verification failed
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

  const centralOrigin = typeof window !== "undefined" ? window.location.origin : "https://carf.indevs.in";
  const displayToken = installToken || (selectedConnection?.installTokenPrefix ? `${selectedConnection.installTokenPrefix}...` : "<install_token>");
  const installCommand = `curl -fsSL ${centralOrigin}/install.sh | bash -s -- --token=${displayToken}`;

  const copyInstallCommand = () => {
    navigator.clipboard.writeText(installCommand);
    setCopiedInstallCmd(true);
    setTimeout(() => setCopiedInstallCmd(false), 2500);
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
          { step: 4, label: "4. Install Agent" },
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

      {selectedConnection && selectedRepo && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {selectedRepo.full_name} is already linked
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              PM2 target and `.carf.yml` from the last save are kept. You do not need to onboard again.
            </p>
          </div>
          <a
            href={projectPageHref(selectedRepo.owner.login, selectedRepo.name)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Open project
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      )}

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
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedRepoFullName(next);
                    const conn = findRepoConnection(connections, next);
                    if (conn?.storedConfig) {
                      applyStoredPm2Fields(conn.storedConfig);
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {repos.map((r) => (
                    <option key={r.id} value={r.full_name}>
                      {r.full_name} {r.private ? "(Private)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={!selectedRepo}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <span>Continue to PM2 App</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: PM2 Target Discovery */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Step 2: Choose Target PM2 App</h2>
                <p className="text-xs text-muted-foreground">
                  Select the PM2 application process that runs this repository&apos;s build on the host.
                </p>
              </div>
            {pm2Error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{pm2Error}</span>
              </div>
            )}

            <button
                type="button"
                onClick={fetchPm2Apps}
                disabled={loadingPm2}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted"
              >
                <RefreshCw className={`size-3 ${loadingPm2 ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingPm2 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                <p className="mt-2">Discovering PM2 processes on host...</p>
              </div>
            ) : pm2Apps.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <AlertTriangle className="mx-auto size-6 text-amber-500" />
                <p className="mt-2 text-xs font-semibold text-foreground">No PM2 apps auto-detected</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  You can specify the target PM2 process name manually below, or install the agent directly on your server in Step 4.
                </p>
                <div className="mt-3 max-w-sm mx-auto">
                  <input
                    type="text"
                    value={selectedTargetName}
                    onChange={(e) => setSelectedTargetName(e.target.value)}
                    placeholder="Enter PM2 app name (e.g. my-app)"
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

            {commitError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                <p className="font-semibold">Error:</p>
                <p className="mt-0.5">{commitError}</p>
              </div>
            )}

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
                onClick={completeStep3AndProceed}
                disabled={committing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {committing ? <Loader2 className="size-3.5 animate-spin" /> : null}
                <span>Generate Install Token & Continue</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Install PM2 Agent & Connection Verification */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Step 4: Install CARF Agent on your Server</h2>
              <p className="text-xs text-muted-foreground">
                Run the one-line installer command on your host server. The agent connects to your PM2 process, validates the 7 host verification checks, and reports heartbeats securely over HTTPS.
              </p>
            </div>

            {/* Install Command Card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="size-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Run on your host server</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
                    Planned (Issue #153)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  <span>Scoped token • Zero database credentials</span>
                </div>
              </div>

              <div className="relative">
                <div className="absolute top-2.5 left-2.5 z-10">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                    Not yet available
                  </span>
                </div>
                <pre className="rounded-lg border border-border bg-slate-950 p-3.5 pt-8 font-mono text-xs text-slate-100 overflow-x-auto select-all opacity-80">
                  {installCommand}
                </pre>
                <button
                  type="button"
                  onClick={copyInstallCommand}
                  className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 shadow-xs hover:bg-slate-800 transition-colors"
                >
                  {copiedInstallCmd ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span>{copiedInstallCmd ? "Copied!" : "Copy Command"}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>Automated host agent installer is planned (tracked in Issue #153). Setup wizard configures Standalone PM2 directly.</span>
                {generatingToken && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Loader2 className="size-3 animate-spin" /> Generating token...
                  </span>
                )}
              </div>
            </div>

            {/* Live Agent Status Polling Box */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold text-foreground">Agent Status:</span>
                  {agentStatus === "online" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      Agent Connected ✓ {agentVersion ? `(v${agentVersion})` : ""}
                    </span>
                  ) : agentStatus === "revoked" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                      <span className="size-2 rounded-full bg-red-500" />
                      Agent Revoked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <Loader2 className="size-3 animate-spin text-amber-500" />
                      Waiting for agent...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={runVerification}
                    disabled={verifying}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                    title="Run connection check via central core API directly"
                  >
                    {verifying ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                    <span>Run Connection Check</span>
                  </button>
                </div>
              </div>

              {agentLastHeartbeat && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  Last heartbeat received: {new Date(agentLastHeartbeat).toLocaleTimeString()}
                </p>
              )}

              {/* 7 Verification Checks Display */}
              {verificationResult && verificationResult.checks.length > 0 ? (
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
                          ? `Host verification complete: All ${verificationResult.checks.length} checks passed.`
                          : "Host verification reported warnings or failures."}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
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
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg bg-card">
                  {agentStatus === "never-installed"
                    ? "Paste and run the install command on your host to report the 7 verification checks."
                    : "No verification checks reported yet. Click 'Run Connection Check' or run 'node agent.mjs --verify' on your host."}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="rounded-lg border border-border px-4 py-2 text-xs text-foreground hover:bg-muted"
              >
                Back
              </button>
              <div className="flex items-center gap-3">
                {selectedRepo && (
                  <a
                    href={projectPageHref(selectedRepo.owner.login, selectedRepo.name)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    <span>View Project & Rollouts</span>
                    <ArrowRight className="size-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <span>Review .carf.yml</span>
                  <ArrowRight className="size-3.5" />
                </button>
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
