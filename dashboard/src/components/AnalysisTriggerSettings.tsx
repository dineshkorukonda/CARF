"use client";

import { useEffect, useState } from "react";
import { AnalysisTriggerSchema, type AnalysisTrigger } from "../lib/carfConfigSchema";
import { AnalysisTriggerSelect } from "./AnalysisTriggerSelect";
import { Button } from "./ui/button";

export function AnalysisTriggerSettings({ installationId, owner, repo }: { installationId: string; owner: string; repo: string }) {
  const [trigger, setTrigger] = useState<AnalysisTrigger>("both");
  const [saved, setSaved] = useState<AnalysisTrigger | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/config/analysis?${new URLSearchParams({ installationId, owner, repo })}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load analysis settings");
        const value = AnalysisTriggerSchema.parse(data.analysisTrigger);
        setTrigger(value);
        setSaved(value);
      }).catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load analysis settings"); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [installationId, owner, repo, reload]);

  async function save() {
    setBusy(true); setError(null); setMessage("");
    try {
      const response = await fetch("/api/config/analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ installationId, owner, repo, analysisTrigger: trigger }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save analysis settings");
      setSaved(trigger); setMessage("Analysis settings saved to .carf.yml.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save analysis settings"); }
    finally { setBusy(false); }
  }
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold">Automatic analysis</h2>
      <AnalysisTriggerSelect value={trigger} onChange={(value) => { setTrigger(value); setMessage(""); }} disabled={busy || saved === null} />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <p role="status" className="text-xs text-muted-foreground">{busy ? "Loading…" : message}</p>
      {saved === null && error ? <Button variant="outline" onClick={() => { setBusy(true); setError(null); setReload((value) => value + 1); }}>Try again</Button> : <Button onClick={save} disabled={busy || saved === null || trigger === saved}>{busy ? "Please wait…" : "Save analysis settings"}</Button>}
    </section>
  );
}
