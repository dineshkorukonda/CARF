import { useEffect, useState, useRef, useCallback } from "react";
import { ciIsActive, type CiSnapshot } from "./ciStatus";
import { startActivityPolling } from "./activityPolling";

export interface RolloutSampleItem {
  id: string;
  ts: Date | string;
  errorRate: number;
}

export interface LiveRolloutItem {
  id: string;
  commitSha: string;
  status: "PENDING" | "SUCCESS" | "ROLLED_BACK" | "FAILED";
  threshold: number;
  window: number;
  startedAt: Date | string;
  readyAt?: Date | string | null;
  deployedAt?: Date | string | null;
  finishedAt: Date | string | null;
  rolledBack: boolean;
  reason: string | null;
  rollbackVerified: boolean | null;
  rollbackRequestedAt?: Date | string | null;
  rollbackStartedAt?: Date | string | null;
  samples?: RolloutSampleItem[];
}

export function calculateRemainingWindow(startedAt: Date | string, windowSeconds: number, nowMs = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(startedAt).getTime() + windowSeconds * 1000 - nowMs) / 1000));
}

export function shouldPollRollout(rollouts: { status: string }[]): boolean {
  return rollouts.some((r) => r.status === "PENDING");
}

export function useLiveRolloutPolling<TCommit extends { sha: string }>(
  initialRollouts: LiveRolloutItem[],
  installationId: string,
  options: { owner: string; repo: string; initialCommits: TCommit[]; samplesFor?: string; includeSamples: boolean },
) {
  const { owner, repo, initialCommits, samplesFor, includeSamples } = options;
  const [rollouts, setRollouts] = useState(initialRollouts);
  const [commits, setCommits] = useState(initialCommits);
  const [ci, setCi] = useState<CiSnapshot>();
  const [pollingError, setPollingError] = useState(false);
  const refreshRef = useRef<() => void>(() => {});
  const refreshActivity = useCallback(() => refreshRef.current(), []);
  const rolloutsRef = useRef(rollouts);
  useEffect(() => { rolloutsRef.current = rollouts; }, [rollouts]);

  useEffect(() => {
    // Server refreshes are new authoritative snapshots, not just initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRollouts(initialRollouts);
    setCommits(initialCommits);
  }, [initialRollouts, initialCommits]);

  useEffect(() => {
    if (!installationId) return;
    let previousRollouts = "";
    let previousCommits = "";
    let previousCi = "";
    type Snapshot = { rollouts: LiveRolloutItem[]; commits: TCommit[]; ci?: CiSnapshot };
    const polling = startActivityPolling<Snapshot>({
      isVisible: () => document.visibilityState !== "hidden",
      fetchSnapshot: async (signal) => {
        const query = new URLSearchParams({ installationId, owner, repo });
        const sampleId = samplesFor || rolloutsRef.current[0]?.id;
        if (includeSamples && sampleId) query.set("samplesFor", sampleId);
        const response = await fetch(`/api/repo/activity?${query}`, { signal, cache: "no-store" });
        if (!response.ok) throw new Error("Activity unavailable");
        const snapshot = await response.json() as Snapshot;
        if (!Array.isArray(snapshot.rollouts) || !Array.isArray(snapshot.commits)) throw new Error("Invalid activity response");
        return snapshot;
      },
      onSnapshot: (snapshot) => {
        setPollingError(false);
        const nextRollouts = JSON.stringify(snapshot.rollouts);
        const nextCommits = JSON.stringify(snapshot.commits);
        const nextCi = JSON.stringify(snapshot.ci);
        if (nextRollouts !== previousRollouts) { previousRollouts = nextRollouts; setRollouts(snapshot.rollouts); }
        if (nextCommits !== previousCommits) { previousCommits = nextCommits; setCommits(snapshot.commits); }
        if (nextCi !== previousCi) { previousCi = nextCi; setCi(snapshot.ci); }
      },
      onError: () => setPollingError(true),
      delay: (snapshot) => {
        if (shouldPollRollout(snapshot.rollouts)) return 2000;
        return ciIsActive(snapshot.ci) && !snapshot.rollouts.some((r) => r.commitSha === snapshot.ci?.headSha) ? 3000 : 10_000;
      },
    });
    refreshRef.current = polling.refresh;
    document.addEventListener("visibilitychange", polling.refresh);
    window.addEventListener("focus", polling.refresh);
    return () => {
      polling.stop();
      refreshRef.current = () => {};
      document.removeEventListener("visibilitychange", polling.refresh);
      window.removeEventListener("focus", polling.refresh);
    };
  }, [installationId, owner, repo, samplesFor, includeSamples]);

  const pendingRollout = rollouts.find((r) => r.status === "PENDING");
  return { rollouts, commits, ci, refreshActivity, setRollouts, isPolling: shouldPollRollout(rollouts), pendingRollout, pollingError };
}
