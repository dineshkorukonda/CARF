"use client";

import { useMemo, useState } from "react";
import type { RecentCommit } from "../../adapters/coreApi/client";
import { Activity } from "lucide-react";

export interface CommitTrendChartProps {
  commits: RecentCommit[];
  onSelectCommit?: (commit: RecentCommit) => void;
  className?: string;
}

export function CommitTrendChart({
  commits = [],
  onSelectCommit,
  className = "",
}: CommitTrendChartProps) {
  const [hoveredCommit, setHoveredCommit] = useState<RecentCommit | null>(null);

  // Take the most recent commits in chronological order (left to right)
  const chartData = useMemo(() => {
    const list = [...commits].slice(0, 15);
    list.reverse(); // oldest on left, newest on right
    return list;
  }, [commits]);

  if (chartData.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center ${className}`}>
        <Activity className="size-6 text-muted-foreground/50" />
        <p className="mt-2 text-xs text-muted-foreground">
          No commit telemetry recorded yet for this project.
        </p>
      </div>
    );
  }

  // Dimensions
  const width = 800;
  const height = 180;
  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Max value calculation for Y axis (minimum 5%)
  const maxThreshold = Math.max(
    0.05,
    ...chartData.map((c) => c.finalThreshold ?? 0.05),
    ...chartData.map((c) => c.finalErrorRate ?? 0)
  );
  const maxY = Math.ceil(maxThreshold * 100 * 1.2) / 100; // in ratio (e.g. 0.06 = 6%)

  // X coordinate calculation
  const getX = (index: number) => {
    if (chartData.length === 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (chartData.length - 1)) * chartWidth;
  };

  // Y coordinate calculation
  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxY, val));
    return paddingTop + chartHeight - (clamped / maxY) * chartHeight;
  };

  // Build SVG path for the dynamic threshold ceiling line
  const thresholdPoints = chartData.map((c, i) => ({
    x: getX(i),
    y: getY(c.finalThreshold ?? 0.05),
    commit: c,
  }));

  const thresholdPathD = thresholdPoints.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  // Area fill below threshold
  const areaPathD =
    thresholdPoints.length > 0
      ? `${thresholdPathD} L ${thresholdPoints[thresholdPoints.length - 1]!.x} ${paddingTop + chartHeight} L ${thresholdPoints[0]!.x} ${paddingTop + chartHeight} Z`
      : "";

  return (
    <div className={`rounded-xl border border-border bg-card p-5 shadow-2xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">
              Commit Rollout Risk & Tolerance Trend
            </h3>
            <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Last {chartData.length} Commits
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Visualizing AST-calibrated error budget ceilings against post-deploy outcomes.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-blue-500 rounded" />
            <span className="text-[11px] text-muted-foreground">Budget Ceiling</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-muted-foreground">Clean Rollout</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" />
            <span className="text-[11px] text-muted-foreground">Auto-Rolled Back</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[11px] text-muted-foreground">Observing</span>
          </div>
        </div>
      </div>

      {/* Interactive Chart Container */}
      <div className="relative mt-4 w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[500px]"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="thresholdAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y Axis Labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const val = maxY * (1 - fraction);
            const y = paddingTop + fraction * chartHeight;
            return (
              <g key={fraction}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-border/60"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] font-mono select-none"
                >
                  {(val * 100).toFixed(1)}%
                </text>
              </g>
            );
          })}

          {/* Area under threshold */}
          <path d={areaPathD} fill="url(#thresholdAreaGrad)" />

          {/* Threshold ceiling line */}
          <path
            d={thresholdPathD}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Commit markers & data points */}
          {chartData.map((commit, index) => {
            const x = getX(index);
            const thresholdY = getY(commit.finalThreshold ?? 0.05);
            const errorRateY = commit.finalErrorRate != null ? getY(commit.finalErrorRate) : null;
            const isRolledBack = commit.rolledBack === true;
            const isClean = commit.rolledBack === false;

            const pointColor = isRolledBack ? "#ef4444" : isClean ? "#10b981" : "#f59e0b";

            return (
              <g
                key={commit.sha}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredCommit(commit)}
                onMouseLeave={() => setHoveredCommit(null)}
                onClick={() => onSelectCommit?.(commit)}
              >
                {/* Vertical marker line */}
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={paddingTop + chartHeight}
                  stroke="currentColor"
                  className={`transition-colors ${
                    hoveredCommit?.sha === commit.sha ? "text-primary stroke-2" : "text-border/30 hover:text-border"
                  }`}
                />

                {/* Error rate vertical bar if available */}
                {errorRateY != null && (
                  <line
                    x1={x}
                    y1={paddingTop + chartHeight}
                    x2={x}
                    y2={errorRateY}
                    stroke={pointColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                )}

                {/* Threshold node dot */}
                <circle
                  cx={x}
                  cy={thresholdY}
                  r={hoveredCommit?.sha === commit.sha ? 5 : 3.5}
                  fill="#3b82f6"
                  stroke="white"
                  strokeWidth="1.5"
                  className="transition-all"
                />

                {/* Outcome indicator dot */}
                <circle
                  cx={x}
                  cy={errorRateY ?? thresholdY}
                  r={hoveredCommit?.sha === commit.sha ? 6 : 4.5}
                  fill={pointColor}
                  stroke="white"
                  strokeWidth="1.5"
                  className="transition-all"
                />

                {/* X axis commit label */}
                <text
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  className={`text-[10px] font-mono select-none transition-colors ${
                    hoveredCommit?.sha === commit.sha ? "fill-primary font-bold" : "fill-muted-foreground"
                  }`}
                >
                  {commit.sha.slice(0, 6)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover Detail Card */}
      {hoveredCommit && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-foreground">
              {hoveredCommit.owner}/{hoveredCommit.repo}@{hoveredCommit.sha.slice(0, 7)}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {hoveredCommit.activeTypes.map((t) => (
                <span
                  key={t}
                  className="rounded border border-border bg-background px-1.5 py-0.2 text-[10px] font-medium text-foreground capitalize"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground">Ceiling: </span>
              <span className="font-mono font-bold text-foreground">
                {hoveredCommit.finalThreshold != null
                  ? `${(hoveredCommit.finalThreshold * 100).toFixed(2)}%`
                  : "5.00%"}
              </span>
            </div>

            {hoveredCommit.finalErrorRate != null && (
              <div>
                <span className="text-[10px] text-muted-foreground">Observed: </span>
                <span className={`font-mono font-bold ${hoveredCommit.rolledBack ? "text-rose-600" : "text-emerald-600"}`}>
                  {(hoveredCommit.finalErrorRate * 100).toFixed(2)}%
                </span>
              </div>
            )}

            <div>
              <span className="text-[10px] text-muted-foreground">Status: </span>
              <span className="font-semibold text-foreground">
                {hoveredCommit.rolledBack === true
                  ? "Rolled Back"
                  : hoveredCommit.rolledBack === false
                  ? "Clean"
                  : "Observing"}
              </span>
            </div>

            {onSelectCommit && (
              <button
                type="button"
                onClick={() => onSelectCommit(hoveredCommit)}
                className="rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Inspect AST &rarr;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
