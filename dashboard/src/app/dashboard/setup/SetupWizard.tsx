"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { InstallationRepo } from "../../../adapters/github/reposClient";
import { findRepoConnection, pm2FieldsFromStoredConfig } from "../../../lib/connectionLookup";
import { resolveRepoMode } from "../../../lib/deploymentMode";
import { RepositorySelectionStep } from "./RepositorySelectionStep";
import { DeploymentModeStep } from "./DeploymentModeStep";
import { StandaloneSetup } from "./StandaloneSetup";
import { AugmentSetup } from "./AugmentSetup";

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
  const githubInstallation = installations.find((i) => !i.installationId.startsWith("host_"));
  const primaryInstallationId = githubInstallation?.installationId || installations[0]?.installationId || "";

  // Pre-seed if initialRepoFullName is provided
  const seedRepo = initialRepoFullName || "";
  const existingConn = seedRepo ? findRepoConnection(connections, seedRepo) : null;
  const initialMode = existingConn ? resolveRepoMode(existingConn) : null;

  // Global wizard steps: 1 = Select Repo, 2 = Choose Mode, 3 = Mode-specific setup
  const [step, setStep] = useState<1 | 2 | 3>(seedRepo ? (initialMode ? 3 : 2) : 1);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>(seedRepo);
  const [selectedMode, setSelectedMode] = useState<"standalone" | "augment" | null>(initialMode);

  // Connected repository names set for fast lookup
  const connectedRepoNames = new Set(
    connections.map((c) => `${c.owner}/${c.repo}`.toLowerCase())
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

  const initialPm2 = existingConn ? pm2FieldsFromStoredConfig(existingConn.storedConfig) : {};

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
            Configure deployment policies, runtime observability, and automated rollbacks for your applications.
          </p>
        </div>

        {/* Global Progress Indicators */}
        <div className="flex items-center gap-3 text-xs">
          <div
            className={`flex items-center gap-1.5 font-semibold ${
              step >= 1 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[10px] ${
                step > 1
                  ? "bg-primary text-primary-foreground"
                  : step === 1
                  ? "border border-primary text-primary"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {step > 1 ? <CheckCircle2 className="size-3" /> : "1"}
            </span>
            <span>Select Repo</span>
          </div>

          <div className="h-px w-6 bg-border" />

          <div
            className={`flex items-center gap-1.5 font-semibold ${
              step >= 2 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[10px] ${
                step > 2
                  ? "bg-primary text-primary-foreground"
                  : step === 2
                  ? "border border-primary text-primary"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {step > 2 ? <CheckCircle2 className="size-3" /> : "2"}
            </span>
            <span>Choose Mode</span>
          </div>

          <div className="h-px w-6 bg-border" />

          <div
            className={`flex items-center gap-1.5 font-semibold ${
              step === 3 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[10px] ${
                step === 3
                  ? "border border-primary text-primary"
                  : "border border-border text-muted-foreground"
              }`}
            >
              3
            </span>
            <span>Configure</span>
          </div>
        </div>
      </div>

      {/* STEP 1: SELECT REPOSITORY */}
      {step === 1 && (
        <RepositorySelectionStep
          repos={initialRepos}
          selectedRepoFullName={selectedRepoFullName}
          onSelectRepo={(fullName) => setSelectedRepoFullName(fullName)}
          onContinue={() => setStep(2)}
          hasGithubApp={Boolean(githubInstallation)}
          connectedRepoNames={connectedRepoNames}
        />
      )}

      {/* STEP 2: CHOOSE DEPLOYMENT MODE */}
      {step === 2 && (
        <DeploymentModeStep
          selectedRepo={selectedRepo}
          selectedMode={selectedMode}
          onSelectMode={(mode) => setSelectedMode(mode)}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}

      {/* STEP 3: CONFIGURE (STANDALONE OR AUGMENT) */}
      {step === 3 && selectedRepo && selectedMode === "standalone" && (
        <StandaloneSetup
          repo={selectedRepo}
          installationId={primaryInstallationId}
          accountName={accountName}
          initialPm2={initialPm2}
          onBackToMode={() => setStep(2)}
        />
      )}

      {step === 3 && selectedRepo && selectedMode === "augment" && (
        <AugmentSetup
          repo={selectedRepo}
          installationId={primaryInstallationId}
          onBackToMode={() => setStep(2)}
        />
      )}
    </div>
  );
}
