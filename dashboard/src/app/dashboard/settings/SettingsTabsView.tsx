"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Shield, User, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
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
          <h1 className="text-xl font-bold tracking-tight text-foreground">Settings & Integrations</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage your GitHub App connection, installation API keys, and account security.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
          <span>Account Profile & Security</span>
        </button>
      </div>

      {/* Tab 1: GitHub App & API Keys */}
      {activeTab === "github" && (
        <div className="space-y-6">
          {bannerError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">GitHub Integration Alert</p>
                <p className="mt-0.5">
                  {bannerError === "invalid_install_state"
                    ? "GitHub redirect state verification timed out or was not received. You can paste your Installation ID manually below to complete setup."
                    : bannerError === "already_linked_to_another_account"
                    ? "This installation ID is already linked to another CARF account."
                    : bannerError === "invalid_installation_id"
                    ? "The specified installation ID was not recognized as a valid numeric ID."
                    : "The GitHub App install callback could not be completed automatically. Paste your numeric Installation ID below."}
                </p>
              </div>
            </div>
          )}

          {bannerSuccess && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Installation Linked</p>
                <p className="mt-0.5">Your GitHub App installation was successfully connected to your account.</p>
              </div>
            </div>
          )}

          <GithubAppProbeCard />

          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="border-b border-border p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Active GitHub App Installations ({installations.length})
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Each installation is granted access to selected repositories and authenticated via a dedicated installation API key.
              </p>
            </div>

            {installations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <p>No GitHub App installations linked to your account.</p>
                <div className="mt-3">
                  <a
                    href="/api/github-app/install/start"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="size-3.5" />
                    <span>Install CARF GitHub App</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {installations.map((inst) => (
                  <div key={inst.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          {inst.targetLogin || `Installation #${inst.installationId}`}
                        </span>
                        <span className="rounded border border-border bg-muted/40 px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                          ID: {inst.installationId}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground text-[11px]">Core API Key:</span>
                        <ApiKeyCopyButton apiKey={inst.coreApiKey} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
                      >
                        <span>Open repositories</span>
                      </Link>
                      <a
                        href={`https://github.com/settings/installations/${inst.installationId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <span>GitHub Settings</span>
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ManualInstallForm />
        </div>
      )}

      {/* Tab 2: Account Profile & Security */}
      {activeTab === "account" && (
        <div>
          <AccountSettingsView initialAccount={account} />
        </div>
      )}
    </main>
  );
}
