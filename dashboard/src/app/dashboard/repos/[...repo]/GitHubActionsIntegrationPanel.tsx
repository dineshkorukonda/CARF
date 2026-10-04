"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Check, Copy, Loader2, Zap } from "lucide-react";

type IntegrationStatus = "not_configured" | "configuring" | "ready" | "needs_attention" | "failed";

interface VerificationCheck {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

interface IntegrationState {
  status: IntegrationStatus;
  repository: string;
  installationId: string;
  branch: string | null;
  workflowPath: string;
  lastVerifiedAt: string | null;
  lastSyncAt: string | null;
  lastPolicyAt: string | null;
  lastCommitSha: string | null;
  lastError: string | null;
  checks?: VerificationCheck[];
  policy?: { commit: string; changeVector: Record<string, number>; threshold: number; window: number } | null;
  manualWorkflow?: string;
}

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  not_configured: "Not configured",
  configuring: "Configuring",
  ready: "Ready",
  needs_attention: "Needs attention",
  failed: "Failed",
};

const STATUS_STYLE: Record<IntegrationStatus, string> = {
  not_configured: "border-border bg-muted/40 text-muted-foreground",
  configuring: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  needs_attention: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-600",
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

type Action = "install" | "verify" | "reconfigure" | "disable";

/**
 * GitHub Actions is the deployment integration CARF can configure automatically through its
 * GitHub App. All GitHub work happens server-side; this component only calls the integration
 * API and renders safe metadata -- it never holds a token, API key, or secret value.
 */
export function GitHubActionsIntegrationPanel({
  repositoryId,
  defaultBranch,
}: {
  repositoryId: string;
  defaultBranch: string;
}) {
  const base = `/api/repositories/${repositoryId}/integrations/github-actions`;
  const [state, setState] = useState<IntegrationState | null>(null);
  const [manualWorkflow, setManualWorkflow] = useState<string>("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(base);
      const data = (await res.json()) as IntegrationState & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load integration status.");
        return;
      }
      setState(data);
      setManualWorkflow(data.manualWorkflow ?? "");
    } catch {
      setError("Could not reach CARF to load integration status.");
    }
  }, [base]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void load();
  }, [load]);

  const run = async (action: Action) => {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as IntegrationState & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "The request failed.");
        await load();
        return;
      }
      setState((prev) => ({ ...(prev ?? ({} as IntegrationState)), ...data, manualWorkflow: prev?.manualWorkflow }));
    } catch {
      setError("Could not reach CARF. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const status: IntegrationStatus = busy === "install" || busy === "reconfigure" ? "configuring" : (state?.status ?? "not_configured");
  const connected = status === "ready" || status === "needs_attention";
  const branch = state?.branch ?? defaultBranch;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-foreground">GitHub Actions Integration</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            CARF configures this repository automatically through its GitHub App. Your pipeline gets the threshold, observation window and
            change vector directly during CI/CD.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}>
          {status === "configuring" ? <Loader2 className="size-3 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
          {STATUS_LABEL[status]}
        </span>
      </div>

      {connected || status === "failed" ? (
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {[
            ["Repository", state?.repository],
            ["Branch", branch],
            ["GitHub App installation", state?.installationId],
            ["Workflow path", state?.workflowPath],
            ["Last synchronization", formatTime(state?.lastSyncAt ?? null)],
            ["Last policy generated", formatTime(state?.lastPolicyAt ?? null)],
            ["Last commit analyzed", state?.lastCommitSha ? state.lastCommitSha.slice(0, 7) : "—"],
            ["Last verified", formatTime(state?.lastVerifiedAt ?? null)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <dt className="text-[11px] font-medium text-muted-foreground uppercase">{label}</dt>
              <dd className="font-mono text-[11px] text-foreground truncate">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {!error && state?.lastError && status !== "ready" && status !== "configuring" ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{state.lastError}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {connected ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" /> GitHub Actions Connected
            </span>
            <button type="button" disabled={busy !== null} onClick={() => run("reconfigure")} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 disabled:opacity-50">
              {busy === "reconfigure" ? "Reconfiguring…" : "Reconfigure"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => run("verify")} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 disabled:opacity-50">
              {busy === "verify" ? "Verifying…" : "Verify Integration"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => run("disable")} className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 disabled:opacity-50">
              {busy === "disable" ? "Disabling…" : "Disable Integration"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("install")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy === "install" ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {busy === "install" ? "Integrating…" : status === "failed" ? "Retry Fully Integrate" : "Fully Integrate GitHub Actions"}
          </button>
        )}
      </div>

      {state?.checks ? (
        <ul className="space-y-1 rounded-lg border border-border bg-muted/20 p-3 text-xs">
          {state.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2">
              {check.ok ? <CheckCircle2 className="mt-0.5 size-3.5 text-emerald-500" /> : <AlertTriangle className="mt-0.5 size-3.5 text-amber-500" />}
              <span>
                {check.label}
                {check.detail ? <span className="text-muted-foreground"> — {check.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {state?.policy ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
          <div className="font-semibold">Policy test (no deployment, no rollback)</div>
          <div className="font-mono text-[11px]">Commit: {state.policy.commit.slice(0, 7)}</div>
          <div className="font-mono text-[11px]">Change vector: {JSON.stringify(state.policy.changeVector)}</div>
          <div className="font-mono text-[11px]">Threshold: {state.policy.threshold}</div>
          <div className="font-mono text-[11px]">Observation window: {state.policy.window}s</div>
        </div>
      ) : null}

      <details className="group rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
          Advanced / Manual configuration
        </summary>
        <div className="space-y-2 border-t border-border p-3">
          <p className="text-[11px] text-muted-foreground">
            Not needed when CARF integrates automatically. This is the exact workflow CARF installs at <code>.github/workflows/carf.yml</code>.
            It reads the <code>CARF_API_KEY</code> repository secret, which CARF configures for you.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!manualWorkflow}
              onClick={() => {
                void navigator.clipboard.writeText(manualWorkflow);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              <span>{copied ? "Copied" : "Copy Configuration"}</span>
            </button>
          </div>
          <pre className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto">{manualWorkflow || "Loading…"}</pre>
        </div>
      </details>
    </div>
  );
}
