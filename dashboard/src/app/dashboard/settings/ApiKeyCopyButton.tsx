"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function ApiKeyCopyButton({
  installationId,
}: {
  installationId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!installationId) {
    return <span className="text-muted-foreground text-xs font-mono">None</span>;
  }

  const handleCopy = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/repo/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId }),
      });
      const data = (await res.json()) as { apiKey?: string; error?: string };
      if (!res.ok || !data.apiKey) {
        throw new Error(data.error || "Could not load API key");
      }
      await navigator.clipboard.writeText(data.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
        ••••••••••••
      </span>
      <button
        type="button"
        onClick={() => void handleCopy()}
        disabled={busy}
        title="Copy API key"
        className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      >
        {copied ? (
          <Check className="size-3 shrink-0 text-emerald-500" />
        ) : (
          <Copy className="size-3 shrink-0 text-muted-foreground" />
        )}
        <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
      </button>
      {error ? <span className="text-[10px] text-rose-600">{error}</span> : null}
    </span>
  );
}
