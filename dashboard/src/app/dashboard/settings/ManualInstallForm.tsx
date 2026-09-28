"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, CheckCircle2, AlertCircle, HelpCircle, ExternalLink } from "lucide-react";

export function ManualInstallForm() {
  const router = useRouter();
  const [installationId, setInstallationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = installationId.trim();

    if (!trimmedId) {
      setError("Please enter an Installation ID.");
      return;
    }

    if (!/^\d+$/.test(trimmedId)) {
      setError("Installation ID must be numeric digits only (e.g. 62738491).");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/github-app/install/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          installationId: trimmedId,
          returnTo: "/dashboard/settings",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Failed to link installation (HTTP ${res.status})`);
      }

      setSuccess(`Installation #${trimmedId} linked successfully!`);
      setInstallationId("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to link installation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Link GitHub App Installation Manually</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            If GitHub did not redirect back after installing the app, paste your numeric Installation ID to link it directly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline self-start sm:self-center"
        >
          <HelpCircle className="size-3.5" />
          <span>{showHelp ? "Hide instructions" : "Where do I find this?"}</span>
        </button>
      </div>

      {showHelp && (
        <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground">Finding your GitHub App Installation ID:</p>
          <ol className="list-decimal list-inside space-y-1 text-[11px]">
            <li>
              Go to your GitHub Account or Organization Settings → <strong>Applications</strong> → <strong>Installed GitHub Apps</strong>.
            </li>
            <li>
              Click <strong>Configure</strong> next to your CARF GitHub App.
            </li>
            <li>
              Look at your browser&apos;s URL:{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground">
                https://github.com/settings/installations/<strong>12345678</strong>
              </code>
            </li>
            <li>
              Copy the numbers at the end of the URL (e.g. <span className="font-mono text-foreground font-semibold">12345678</span>) and paste them below.
            </li>
          </ol>
          <div className="pt-1">
            <a
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
            >
              <span>Open GitHub Installed Applications</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {success && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="font-medium">{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            type="text"
            value={installationId}
            onChange={(e) => setInstallationId(e.target.value)}
            placeholder="e.g. 62738491"
            disabled={loading}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !installationId.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Verifying & Linking...</span>
            </>
          ) : (
            <>
              <Link2 className="size-3.5" />
              <span>Link Installation</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
