"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { InstallationRepo } from "../../../adapters/github/reposClient";
import { findRepoConnection, pm2FieldsFromStoredConfig } from "../../../lib/connectionLookup";
import {
  type DeploymentIntegration,
  type RuntimeAdapter,
  resolveFromLegacy,
} from "../../../lib/capabilities";
import { RepositorySelectionStep } from "./RepositorySelectionStep";
import { DeploymentIntegrationStep } from "./DeploymentIntegrationStep";
import { RuntimeAdapterStep } from "./RuntimeAdapterStep";
import { CapabilitiesPreviewStep } from "./CapabilitiesPreviewStep";
import { AnalysisTriggerSchema, type AnalysisTrigger } from "../../../lib/carfConfigSchema";

export interface InstallationItem {
  id: string;
  installationId: string;
  targetLogin?: string;
  targetType?: string;
}

export interface RepoConnectionItem {
  id: string;
  installationId: string;
  owner: string;
  repo: string;
  mode?: string | null;
  deploymentIntegration?: string | null;
  runtimeAdapter?: string | null;
  verifiedAt: Date | string | null;
  monitoringPaused: boolean;
  storedConfig?: unknown;
  installTokenHash?: string | null;
}

interface SetupWizardProps {
  installations: InstallationItem[];
  initialRepos: InstallationRepo[];
  connections: RepoConnectionItem[];
  initialRepoFullName?: string;
  accountName?: string;
}

export function SetupWizard({
  installations,
  initialRepos,
  connections,
  initialRepoFullName = "",
  accountName = "server",
}: SetupWizardProps) {
  // Determine if a GitHub App is attached
  const githubInstallation = (installations || []).find(
    (i) => !String(i?.installationId || "").startsWith("host_")
  );
  const primaryInstallationId =
    githubInstallation?.installationId || installations?.[0]?.installationId || "";

  // Pre-seed if initialRepoFullName is provided
  const seedRepo = initialRepoFullName || "";
  const existingConn = seedRepo ? findRepoConnection(connections || [], seedRepo) : null;
  const initialResolved = existingConn ? resolveFromLegacy(existingConn) : null;

  // Global wizard steps: 1 = Select Repo, 2 = Deployment Integration, 3 = Runtime Adapter, 4 = Capabilities Preview
  const [step, setStep] = useState<1 | 2 | 3 | 4>(seedRepo ? 2 : 1);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>(seedRepo);
  const [analysisTrigger, setAnalysisTrigger] = useState<AnalysisTrigger>("both");
  const [analysisLoading, setAnalysisLoading] = useState(Boolean(existingConn));
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    const conn = findRepoConnection(connections || [], selectedRepoFullName);
    if (!conn) return;
    const controller = new AbortController();
    fetch(`/api/config/analysis?${new URLSearchParams({ installationId: conn.installationId, owner: conn.owner, repo: conn.repo })}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load analysis settings");
        setAnalysisTrigger(AnalysisTriggerSchema.parse(data.analysisTrigger));
      }).catch((err) => { if (!controller.signal.aborted) setAnalysisError(err instanceof Error ? err.message : "Could not load analysis settings"); })
      .finally(() => { if (!controller.signal.aborted) setAnalysisLoading(false); });
    return () => controller.abort();
  }, [connections, selectedRepoFullName]);

  const [deploymentIntegration, setDeploymentIntegration] = useState<DeploymentIntegration>(
    initialResolved?.deploymentIntegration ?? "github_actions"
  );
  const [runtimeAdapter, setRuntimeAdapter] = useState<RuntimeAdapter>(
    initialResolved?.runtimeAdapter ?? "none"
  );

  const initialPm2 = existingConn ? pm2FieldsFromStoredConfig(existingConn.storedConfig) : {};
  const [pm2Config, setPm2Config] = useState<{
    targetName: string;
    cwd: string;
    healthUrl: string;
    buildCommand: string;
    layout: "releases" | "git";
  }>({
    targetName: initialPm2.targetName || "",
    cwd: initialPm2.cwd || `/opt/${seedRepo ? seedRepo.split("/")[1] || "app" : "app"}`,
    healthUrl: initialPm2.healthUrl || "http://127.0.0.1:3000/healthz",
    buildCommand: initialPm2.buildCommand || "",
    layout: initialPm2.layout || "git",
  });

  const [dockerConfig, setDockerConfig] = useState<{
    containerName: string;
    composeFile: string;
    healthUrl: string;
  }>({
    containerName: "",
    composeFile: "docker-compose.yml",
    healthUrl: "http://127.0.0.1:3000/api/health",
  });

  // Connected repository names set for fast lookup
  const connectedRepoNames = new Set(
    (connections || []).map((c) => `${c.owner}/${c.repo}`.toLowerCase())
  );

  const selectedRepo =
    initialRepos.find((r) => r.full_name.toLowerCase() === selectedRepoFullName.toLowerCase()) ||
    (selectedRepoFullName
      ? {
          id: 0,
          name: selectedRepoFullName.split("/")[1] || selectedRepoFullName,
          full_name: selectedRepoFullName,
          owner: { login: selectedRepoFullName.split("/")[0] || accountName },
          default_branch: "main",
          private: false,
        }
      : null);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3" />
              <span>Back to repositories</span>
            </Link>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            Connect Repository
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure 3-layer architecture: CARF Core policy, deployment integrations, and runtime adapters.
          </p>
        </div>
      </div>

      {/* Wizard Step Progression Bar */}
      <div className="grid grid-cols-4 gap-2">
        <div
          className={`flex items-center gap-2 border-b-2 pb-2 text-xs font-medium transition-colors ${
            step === 1
              ? "border-primary text-primary"
              : step > 1
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-border text-muted-foreground"
          }`}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px]">
            {step > 1 ? <CheckCircle2 className="size-3 text-emerald-500" /> : "1"}
          </span>
          <span className="truncate">Repository</span>
        </div>

        <div
          className={`flex items-center gap-2 border-b-2 pb-2 text-xs font-medium transition-colors ${
            step === 2
              ? "border-primary text-primary"
              : step > 2
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-border text-muted-foreground"
          }`}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px]">
            {step > 2 ? <CheckCircle2 className="size-3 text-emerald-500" /> : "2"}
          </span>
          <span className="truncate">Deployment</span>
        </div>

        <div
          className={`flex items-center gap-2 border-b-2 pb-2 text-xs font-medium transition-colors ${
            step === 3
              ? "border-primary text-primary"
              : step > 3
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-border text-muted-foreground"
          }`}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px]">
            {step > 3 ? <CheckCircle2 className="size-3 text-emerald-500" /> : "3"}
          </span>
          <span className="truncate">Runtime</span>
        </div>

        <div
          className={`flex items-center gap-2 border-b-2 pb-2 text-xs font-medium transition-colors ${
            step === 4
              ? "border-primary text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px]">
            4
          </span>
          <span className="truncate">Preview &amp; Connect</span>
        </div>
      </div>

      {/* STEP 1: CHOOSE REPO */}
      {step === 1 && (
        <RepositorySelectionStep
          repos={initialRepos}
          hasGithubApp={Boolean(githubInstallation)}
          connectedRepoNames={connectedRepoNames}
          selectedRepoFullName={selectedRepoFullName}
          onSelectRepo={(fullName) => {
            setSelectedRepoFullName(fullName);
            const repoConn = findRepoConnection(connections || [], fullName);
            setAnalysisError(null);
            setAnalysisTrigger("both");
            setAnalysisLoading(Boolean(repoConn));
            if (repoConn) {
              const res = resolveFromLegacy(repoConn);
              setDeploymentIntegration(res.deploymentIntegration);
              setRuntimeAdapter(res.runtimeAdapter);
              const pm2 = pm2FieldsFromStoredConfig(repoConn.storedConfig);
              if (pm2.targetName) {
                setPm2Config((prev) => ({
                  ...prev,
                  targetName: pm2.targetName || prev.targetName,
                  cwd: pm2.cwd || prev.cwd,
                  healthUrl: pm2.healthUrl || prev.healthUrl,
                  buildCommand: pm2.buildCommand || prev.buildCommand,
                  layout: pm2.layout || prev.layout,
                }));
              }
            } else {
              setDeploymentIntegration("github_actions");
              setRuntimeAdapter("none");
              setPm2Config((prev) => ({
                ...prev,
                targetName: fullName.split("/")[1] || "",
                cwd: `/opt/${fullName.split("/")[1] || "app"}`,
              }));
            }
          }}
          onContinue={() => setStep(2)}
        />
      )}

      {/* STEP 2: CHOOSE DEPLOYMENT INTEGRATION */}
      {step === 2 && (
        <DeploymentIntegrationStep
          selectedRepo={selectedRepo}
          selectedIntegration={deploymentIntegration}
          analysisTrigger={analysisTrigger}
          onAnalysisTriggerChange={setAnalysisTrigger}
          analysisLoading={analysisLoading}
          analysisError={analysisError}
          onSelectIntegration={(integration) => setDeploymentIntegration(integration)}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}

      {/* STEP 3: CHOOSE RUNTIME ADAPTER */}
      {step === 3 && (
        <RuntimeAdapterStep
          installationId={primaryInstallationId}
          selectedRepo={selectedRepo}
          selectedAdapter={runtimeAdapter}
          onSelectAdapter={(adapter) => setRuntimeAdapter(adapter)}
          pm2Config={pm2Config}
          onChangePm2Config={(cfg) => setPm2Config(cfg)}
          dockerConfig={dockerConfig}
          onChangeDockerConfig={(cfg) => setDockerConfig(cfg)}
          onBack={() => setStep(2)}
          onContinue={() => setStep(4)}
        />
      )}

      {/* STEP 4: CAPABILITIES PREVIEW & CONFIRMATION */}
      {step === 4 && selectedRepo && (
        <CapabilitiesPreviewStep
          repo={selectedRepo}
          installationId={primaryInstallationId}
          deploymentIntegration={deploymentIntegration}
          analysisTrigger={analysisTrigger}
          runtimeAdapter={runtimeAdapter}
          pm2Config={pm2Config}
          dockerConfig={dockerConfig}
          onBack={() => setStep(3)}
        />
      )}
    </div>
  );
}
