"use client";

import { useMemo, useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle, Clock, Radio, Activity, CheckCircle2 } from "lucide-react";

export interface CommitMetricGaugesProps {
  finalThreshold: number | null;
  finalWindow: number | null;
  finalErrorRate?: number | null;
  rolledBack?: boolean | null;
  createdAt: string | Date;
  className?: string;
}

export function CommitMetricGauges({
  finalThreshold,
  finalWindow,
  finalErrorRate,
  rolledBack,
  createdAt,
  className = "",
}: CommitMetricGaugesProps) {
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const createdTime = useMemo(() => new Date(createdAt).getTime(), [createdAt]);
  const windowSecs = finalWindow ?? 180;
  const elapsedSecs = now > 0 ? Math.max(0, Math.floor((now - createdTime) / 1000)) : 0;
  const isObserving = rolledBack === null && (now > 0 ? elapsedSecs < windowSecs : true);
  const remainingSecs = Math.max(0, windowSecs - elapsedSecs);
  const soakProgressPct = Math.min(100, Math.round((elapsedSecs / windowSecs) * 100));

  const thresholdPct = finalThreshold != null && Number.isFinite(finalThreshold) ? finalThreshold * 100 : 5.0;
  const errorRatePct = finalErrorRate != null ? finalErrorRate * 100 : null;

  // Max scale for the error rate gauge (e.g. 1.5x threshold or minimum 6%)
  const maxScale = Math.max(6.0, thresholdPct * 1.5, (errorRatePct ?? 0) * 1.2);
  const thresholdMarkerPosition = Math.min(98, (thresholdPct / maxScale) * 100);
  const errorRateBarWidth = errorRatePct != null ? Math.min(100, (errorRatePct / maxScale) * 100) : 0;

  const isBreached = rolledBack === true || (errorRatePct != null && errorRatePct > thresholdPct);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* Dynamic Error Budget vs Observed Rate Gauge */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4.5 shadow-2xs">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Activity className="size-3.5 text-primary" />
              Dynamic Error Budget
            </span>
            {isBreached ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="size-2.5" />
                Budget Breached
              </span>
            ) : isObserving ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
                <Radio className="size-2.5" />
                Under Observation
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-2.5" />
                Budget Maintained
              </span>
            )}
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {finalThreshold != null
                  ? `${(finalThreshold * 100).toFixed(2)}%`
                  : "5.00%"}
              </span>
              <span className="ml-1 text-xs text-muted-foreground">tolerance ceiling</span>
            </div>

            {errorRatePct != null && (
              <div className="text-right">
                <span className={`text-sm font-mono font-bold ${isBreached ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {errorRatePct.toFixed(2)}%
                </span>
                <p className="text-[10px] text-muted-foreground">actual error rate</p>
              </div>
            )}
          </div>

          {/* Visual Comparator Bar */}
          <div className="relative mt-4 h-4 w-full rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden">
            {/* Observed Error Rate Fill */}
            {errorRatePct != null && (
              <div
                style={{ width: `${errorRateBarWidth}%` }}
                className={`h-full transition-all duration-500 ${
                  isBreached
                    ? "bg-rose-500"
                    : "bg-emerald-500"
                }`}
              />
            )}

            {/* Threshold Ceiling Marker Pin */}
            <div
              style={{ left: `${thresholdMarkerPosition}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10 shadow-xs"
              title={`Tolerance limit: ${thresholdPct.toFixed(2)}%`}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>0%</span>
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <span className="inline-block size-1.5 bg-foreground rounded-full" />
              Ceiling: {thresholdPct.toFixed(2)}%
            </span>
            <span>{maxScale.toFixed(1)}% max</span>
          </div>
        </div>
      </div>

      {/* Soak Window Observation Progress */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4.5 shadow-2xs">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              Canary Soak Window
            </span>
            {isObserving ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
                <Radio className="size-2.5" />
                {remainingSecs}s remaining
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-2.5" />
                Soak Completed
              </span>
            )}
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {windowSecs}s
              </span>
              <span className="ml-1 text-xs text-muted-foreground">
                ({Math.round(windowSecs / 60)} min soak)
              </span>
            </div>

            <span className="text-xs font-mono text-muted-foreground">
              {isObserving ? `${elapsedSecs}s elapsed` : "100% verified"}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-4 w-full rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5">
            <div
              style={{ width: `${isObserving ? soakProgressPct : 100}%` }}
              className={`h-full rounded-sm transition-all duration-300 ${
                isObserving
                  ? "bg-amber-500"
                  : rolledBack === true
                  ? "bg-rose-500"
                  : "bg-emerald-500"
              }`}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Deploy</span>
            <span>
              {isObserving ? "Actively probing telemetry" : "Rollout evaluation finished"}
            </span>
            <span>Soak Complete</span>
          </div>
        </div>
      </div>
    </div>
  );
}
