"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
  Key,
  Layers,
  Link as LinkIcon,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import type { ProbeReport } from "../../../adapters/github/appProbeClient";

export function GithubAppProbeCard() {
  const [report, setReport] = useState<ProbeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runProbe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/github-app/probe");
      if (!res.ok) {
        throw new Error(`Probe failed with HTTP status ${res.status}`);
      }
      const data: ProbeReport = await res.json();
      setReport(data);
      setExpanded(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute probe";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function renderStatusBadge(status: string) {
    switch (status) {
      case "ok":
      case "healthy":
        return (
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
            Passed
          </Badge>
        );
      case "warning":
      case "degraded":
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
            Warning
          </Badge>
        );
      case "error":
      case "failed":
        return (
          <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px]">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-muted-foreground text-[10px]">
            Skipped
          </Badge>
        );
    }
  }

  return (
    <div className="rounded-sm border border-border bg-card p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              GitHub App Integration Probe
            </h2>
            {report && renderStatusBadge(report.overallStatus)}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Live diagnostic probe verifying RS256 JWT signing, GitHub App identity, installations, token exchange, and repository access.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={runProbe}
            disabled={loading}
            className="gap-1.5 font-medium text-xs"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Probing..." : report ? "Re-run Probe" : "Run Integration Probe"}</span>
          </Button>
          {report && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title={expanded ? "Collapse details" : "Expand details"}
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {report && expanded && (
        <div className="space-y-4 pt-2 border-t border-border">
          {/* Status summary banner */}
          <div
            className={`rounded-sm border p-3 text-xs flex items-start gap-2.5 ${
              report.overallStatus === "healthy"
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                : report.overallStatus === "degraded"
                ? "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300"
                : "border-rose-500/30 bg-rose-500/5 text-rose-800 dark:text-rose-300"
            }`}
          >
            {report.overallStatus === "healthy" ? (
              <ShieldCheck className="size-4 shrink-0 text-emerald-500 mt-0.5" />
            ) : report.overallStatus === "degraded" ? (
              <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
            ) : (
              <ShieldAlert className="size-4 shrink-0 text-rose-500 mt-0.5" />
            )}
            <div className="flex-1 space-y-1">
              <span className="font-semibold block">
                {report.overallStatus === "healthy"
                  ? "GitHub App Integration is Fully Operational"
                  : report.overallStatus === "degraded"
                  ? "Integration is Partially Working with Warnings"
                  : "Integration Probe Detected Critical Issues"}
              </span>
              <p className="text-[11px] opacity-90">
                Timestamp: {new Date(report.timestamp).toLocaleTimeString()} · Tested 5 diagnostic layers.
              </p>
            </div>
          </div>

          {/* Detailed checks list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* 1. Credentials Check */}
            <div className="rounded-sm border border-border bg-muted/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5 text-foreground">
                  <Key className="size-3.5 text-muted-foreground" />
                  <span>1. App Credentials & JWT</span>
                </span>
                {renderStatusBadge(report.checks.credentials.status)}
              </div>
              <p className="text-[11px] text-muted-foreground">{report.checks.credentials.message}</p>
              {report.checks.credentials.latencyMs !== undefined && (
                <span className="text-[10px] font-mono text-muted-foreground/70 block">
                  Latency: {report.checks.credentials.latencyMs}ms
                </span>
              )}
            </div>

            {/* 2. GitHub App Identity */}
            <div className="rounded-sm border border-border bg-muted/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5 text-foreground">
                  <Cpu className="size-3.5 text-muted-foreground" />
                  <span>2. GitHub App Identity (/app)</span>
                </span>
                {renderStatusBadge(report.checks.githubApp.status)}
              </div>
              <p className="text-[11px] text-muted-foreground">{report.checks.githubApp.message}</p>
              {report.checks.githubApp.permissions && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {Object.entries(report.checks.githubApp.permissions).map(([k, v]) => (
                    <span key={k} className="text-[9px] font-mono px-1.5 py-0.5 rounded-xs bg-background border border-border">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 3. GitHub Installations */}
            <div className="rounded-sm border border-border bg-muted/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5 text-foreground">
                  <Layers className="size-3.5 text-muted-foreground" />
                  <span>3. Installations on GitHub</span>
                </span>
                {renderStatusBadge(report.checks.installations.status)}
              </div>
              <p className="text-[11px] text-muted-foreground">{report.checks.installations.message}</p>
              {report.checks.installations.installations && report.checks.installations.installations.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {report.checks.installations.installations.map((inst) => (
                    <span key={inst.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-background border border-border">
                      {inst.account} (ID: {inst.id})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Token Minting & Repo Access */}
            <div className="rounded-sm border border-border bg-muted/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="size-3.5 text-muted-foreground" />
                  <span>4. Repo Access & Token Minting</span>
                </span>
                {renderStatusBadge(report.checks.tokenAndRepos.status)}
              </div>
              <p className="text-[11px] text-muted-foreground">{report.checks.tokenAndRepos.message}</p>
              {report.checks.tokenAndRepos.accessibleRepos && report.checks.tokenAndRepos.accessibleRepos.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {report.checks.tokenAndRepos.accessibleRepos.map((r) => (
                    <span key={r} className="text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-background border border-border text-foreground">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Core API */}
            {report.checks.coreApi && (
              <div className="rounded-sm border border-border bg-muted/20 p-3 space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5 text-foreground">
                    <Server className="size-3.5 text-muted-foreground" />
                    <span>5. Core API Decision Service</span>
                  </span>
                  {renderStatusBadge(report.checks.coreApi.status)}
                </div>
                <p className="text-[11px] text-muted-foreground">{report.checks.coreApi.message}</p>
              </div>
            )}
          </div>

          {/* Quick link unlinked installations */}
          {report.checks.accountSync.unlinkedOnGithub > 0 && (
            <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <LinkIcon className="size-3.5" />
                <span>Unlinked Installation Found on GitHub</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your GitHub App is installed on GitHub, but not yet linked to this dashboard account.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {report.checks.accountSync.unlinkedInstallationIds.map((id) => (
                  <form key={id} action="/api/github-app/install/manual" method="POST">
                    <input type="hidden" name="installationId" value={id} />
                    <Button type="submit" size="sm" variant="default" className="text-xs h-7 gap-1">
                      <span>Link Installation ID {id}</span>
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          )}

          {/* Actionable recommendations */}
          {report.recommendations.length > 0 && (
            <div className="rounded-sm border border-border bg-muted/30 p-3 space-y-1.5">
              <span className="font-semibold text-xs text-foreground block">
                Recommended Troubleshooting Actions:
              </span>
              <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                {report.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
              <div className="pt-2 flex items-center gap-3">
                <a
                  href="https://github.com/settings/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <span>Open GitHub Developer Settings</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
