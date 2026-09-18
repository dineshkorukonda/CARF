"use client";

import { useState } from "react";
import { X, AlertTriangle, Trash2, Loader2 } from "lucide-react";

export interface UnlinkConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  installationId: string;
  repo: { owner: string; name: string; fullName: string } | null;
  onUnlinked: () => void;
}

export function UnlinkConfirmModal({
  isOpen,
  onClose,
  installationId,
  repo,
  onUnlinked,
}: UnlinkConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !repo) return null;

  const handleUnlink = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/repo/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId,
          owner: repo.owner,
          repo: repo.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to unlink repository.");
      }

      onUnlinked();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred while unlinking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl overflow-hidden flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50 border border-rose-100 text-rose-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Unlink Repository</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{repo.fullName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 leading-relaxed space-y-2">
          <p>
            Unlinking will delete the <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-900">.carf.yml</code> configuration file from <strong className="text-slate-900">{repo.fullName}</strong>.
          </p>
          <p className="text-slate-500 text-[11px]">
            CARF will cease automated rollback triggers and dynamic canary risk calibration on future commits to this repository. You can re-link it at any time.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUnlink}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Unlinking…</span>
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                <span>Confirm Unlink</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
