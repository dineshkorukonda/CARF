"use client";
import { useEffect, useState } from "react";
import { calculateRemainingWindow } from "../lib/useLiveRolloutPolling";

// Tick only this small label, not the entire repository view and its charts.
export function ObservationCountdown({ readyAt, windowSeconds }: { readyAt: Date | string; windowSeconds: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    const tick = () => { if (mounted) setRemaining(calculateRemainingWindow(readyAt, windowSeconds)); };
    queueMicrotask(tick);
    const timer = setInterval(tick, 1000);
    return () => { mounted = false; clearInterval(timer); };
  }, [readyAt, windowSeconds]);
  return remaining === null ? null : <span>Observation window: {remaining}s remaining. </span>;
}
