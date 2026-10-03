"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FolderGit2, Search, ArrowRight, Shield, ExternalLink, Check } from "lucide-react";
import type { InstallationRepo } from "../../../adapters/github/reposClient";

interface RepositorySelectionStepProps {
  repos: InstallationRepo[];
  selectedRepoFullName: string;
  onSelectRepo: (fullName: string) => void;
  onContinue: () => void;
  hasGithubApp: boolean;
  connectedRepoNames: Set<string>;
}

export function RepositorySelectionStep({
  repos,
  selectedRepoFullName,
  onSelectRepo,
  onContinue,
  hasGithubApp,
  connectedRepoNames,
}: RepositorySelectionStepProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
          <span>Step 1</span>
          <span>•</span>
          <span>Repository Registration</span>
        </div>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
          Select GitHub Repository
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a repository granted to your GitHub App. You will configure deployment mode in the next step.
        </p>
      </div>

      {!hasGithubApp ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-foreground space-y-3">
          <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
            <Shield className="size-4 shrink-0" />
            <span>GitHub App Connection Required</span>
          </div>
          <p className="text-xs text-muted-foreground">
            No GitHub App installation was detected for this account. To onboard a repository, connect your GitHub App or grant access to your repositories.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              <span>Go to GitHub Settings</span>
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : repos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
          <FolderGit2 className="mx-auto size-8 text-muted-foreground/60" />
          <p className="text-sm font-semibold text-foreground">No repositories found</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Your GitHub App is connected, but has not been granted access to any repositories. Visit GitHub Settings to update repository permissions.
          </p>
          <div className="pt-2">
            <a
              href="/api/github-app/install/start"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
            >
              <span>Manage GitHub App Permissions</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border">
            {filteredRepos.map((repo) => {
              const isSelected = repo.full_name === selectedRepoFullName;
              const isAlreadyConnected = connectedRepoNames.has(repo.full_name.toLowerCase());

              return (
                <button
                  type="button"
                  key={repo.id}
                  onClick={() => onSelectRepo(repo.full_name)}
                  className={`flex w-full items-center justify-between p-3.5 text-left transition-colors ${
                    isSelected
                      ? "bg-primary/10 border-l-4 border-primary"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                        isSelected
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <FolderGit2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {repo.full_name}
                        </span>
                        {repo.private && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                            Private
                          </span>
                        )}
                        {isAlreadyConnected && (
                          <span className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:text-blue-400">
                            Already linked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Default branch: <span className="font-mono">{repo.default_branch}</span>
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 pl-3">
                    <div
                      className={`size-4 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {isSelected && <Check className="size-2.5 stroke-[3]" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!selectedRepoFullName}
              onClick={onContinue}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-opacity"
            >
              <span>Choose Deployment Mode</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
