import { useEffect, useState, useRef, useCallback } from "react";

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
  finishedAt: Date | string | null;
  rolledBack: boolean;
  reason: string | null;
  rollbackVerified: boolean | null;
  samples?: RolloutSampleItem[];
}

export function calculateRemainingWindow(
  startedAt: Date | string,
  windowSeconds: number,
  nowMs: number = Date.now()
): number {
  const startedMs = new Date(startedAt).getTime();
  const expiryMs = startedMs + windowSeconds * 1000;
  return Math.max(0, Math.ceil((expiryMs - nowMs) / 1000));
}

export function shouldPollRollout(rollouts: { status: string }[]): boolean {
  return rollouts.some((r) => r.status === "PENDING");
}

export function useLiveRolloutPolling(
  initialRollouts: LiveRolloutItem[],
  installationId: string,
  pollIntervalMs: number = 3000
) {
  const [rollouts, setRollouts] = useState<LiveRolloutItem[]>(initialRollouts);
  const rolloutsRef = useRef(rollouts);

  useEffect(() => {
    rolloutsRef.current = rollouts;
  }, [rollouts]);

  // Derive if any rollout is in PENDING state
  const pendingRollout = rollouts.find((r) => r.status === "PENDING");
  const isPolling = shouldPollRollout(rollouts);

  // Countdown timer for active pending rollout
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  const updateCountdown = useCallback(() => {
    if (!pendingRollout) {
      setCountdownSeconds(null);
      return;
    }
    setCountdownSeconds(calculateRemainingWindow(pendingRollout.startedAt, pendingRollout.window));
  }, [pendingRollout]);

  useEffect(() => {
    queueMicrotask(() => updateCountdown());
    if (!isPolling) return;

    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [isPolling, updateCountdown]);

  // Telemetry polling: ONLY runs while at least one rollout is PENDING
  useEffect(() => {
    if (!isPolling || !pendingRollout || !installationId) {
      return;
    }

    let isMounted = true;

    const pollSamples = async () => {
      try {
        const res = await fetch(
          `/api/rollouts/${encodeURIComponent(pendingRollout.id)}/samples?installationId=${encodeURIComponent(
            installationId
          )}`
        );
        if (!res.ok) return;

        const data = await res.json();
        if (isMounted && data.samples) {
          setRollouts((prev) =>
            prev.map((r) => {
              if (r.id === pendingRollout.id) {
                return {
                  ...r,
                  samples: data.samples,
                };
              }
              return r;
            })
          );
        }
      } catch {
        // Network errors during polling do not throw
      }
    };

    const interval = setInterval(pollSamples, pollIntervalMs);
    // Initial fetch immediately
    pollSamples();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isPolling, pendingRollout, installationId, pollIntervalMs]);

  return {
    rollouts,
    setRollouts,
    isPolling,
    pendingRollout,
    countdownSeconds,
  };
}
