"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Check, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/button";

export function RefreshReposButton({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [repoCount, setRepoCount] = useState<number | null>(null);

  async function handleSync() {
    if (loading) return;
    setLoading(true);
    setStatus("idle");

    try {
      const res = await fetch("/api/integration/sync", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(`Sync failed (status ${res.status})`);
      }

      const data = (await res.json()) as { ok: boolean; count: number };
      setRepoCount(data.count);
      setStatus("success");
      router.refresh();

      setTimeout(() => {
        setStatus("idle");
      }, 4000);
    } catch (err) {
      console.error("Failed to sync repos:", err);
      setStatus("error");
      setTimeout(() => {
        setStatus("idle");
      }, 4000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleSync}
      disabled={loading}
      variant="outline"
      size={size}
      className={`bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm transition-all gap-1.5 ${className}`}
      title="Fetch newly granted or created repositories from GitHub"
    >
      {status === "success" ? (
        <>
          <Check className="size-3.5 text-emerald-600" />
          <span className="text-emerald-700 font-medium">
            {repoCount !== null ? `Synced ${repoCount} Repos` : "Synced"}
          </span>
        </>
      ) : status === "error" ? (
        <>
          <AlertCircle className="size-3.5 text-rose-600" />
          <span className="text-rose-700">Sync Failed</span>
        </>
      ) : (
        <>
          <RotateCw className={`size-3.5 text-slate-500 ${loading ? "animate-spin text-slate-900" : ""}`} />
          <span>{loading ? "Syncing..." : "Sync Repositories"}</span>
        </>
      )}
    </Button>
  );
}
