"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Shield, User, ExternalLink, AlertCircle, CheckCircle2, Layers } from "lucide-react";
import { ApiKeyCopyButton } from "./ApiKeyCopyButton";
import { GithubAppProbeCard } from "./GithubAppProbeCard";
import { ManualInstallForm } from "./ManualInstallForm";
import { AccountSettingsView } from "./AccountSettingsView";
import type { AccountRow, InstallationRow } from "../../../lib/accountService";

interface SettingsTabsViewProps {
  account: AccountRow;
  installations: InstallationRow[];
  bannerError?: string;
  bannerSuccess?: string;
}

export function SettingsTabsView({ account, installations, bannerError, bannerSuccess }: SettingsTabsViewProps) {
  const [activeTab, setActiveTab] = useState<"github" | "account">("github");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">GitHub App & Integrations</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Connect the CARF GitHub App, review installations, explore integrations, and manage API keys securely.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/docs/integrations"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition-colors"
          >
            <Layers className="size-3.5 text-primary" />
            <span>Integrations Center</span>
          </Link>
          <a
            href="/api/github-app/install/start"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-3.5" />
            <span>Install / Manage GitHub App</span>
          </a>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("github")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "github"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="size-3.5" />
          <span>GitHub App & API Keys</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "account"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="size-3.5" />
          <span>Account Settings</span>
        </button>
      </div>

      {/* Notification Banners */}
      {bannerError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{bannerError}</span>
        </div>
      )}

      {bannerSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{bannerSuccess}</span>
        </div>
      )}

      {/* Tab Content: GitHub App & Installations */}
      {activeTab === "github" && (
        <div className="flex flex-col gap-6">
          {/* GitHub App Status Probe Card */}
          <GithubAppProbeCard />

          {/* Connected Installations List */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Connected Organizations & Accounts</h2>
              <span className="text-[11px] text-muted-foreground">
                {installations.length} {installations.length === 1 ? "installation" : "installations"}
              </span>
            </div>

            {installations.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/50">
                <Shield className="size-8 text-muted-foreground/50 mb-2" />
                <p className="text-xs font-medium text-foreground">No GitHub App installations found</p>
                <p className="mt-1 text-[11px] text-muted-foreground max-w-sm">
                  Click the button above to install the CARF GitHub App on your personal account or organization to enable automated rollbacks.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                {installations.map((inst) => (
                  <div key={inst.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-xs uppercase">
                        {inst.targetLogin.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{inst.targetLogin}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                            {inst.targetType}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Installation ID: <span className="font-mono">{inst.installationId}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <ApiKeyCopyButton installationId={inst.installationId} />
                      <a
                        href={`https://github.com/settings/installations/${inst.installationId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="size-3" />
                        <span>Manage on GitHub</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Installation Linking Form */}
          <ManualInstallForm />
        </div>
      )}

      {/* Tab Content: User Account Settings */}
      {activeTab === "account" && <AccountSettingsView initialAccount={account} />}
    </main>
  );
}
