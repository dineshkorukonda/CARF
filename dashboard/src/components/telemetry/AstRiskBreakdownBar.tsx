"use client";

import { useMemo } from "react";
import { Database, Server, Package, Sliders, Code2, AlertCircle } from "lucide-react";

export interface AstRiskBreakdownBarProps {
  activeTypes: string[];
  className?: string;
  showLabels?: boolean;
}

interface TypeMeta {
  key: string;
  label: string;
  weight: number;
  color: string;
  bgColor: string;
  textColor: string;
  icon: typeof Code2;
}

const TYPE_CONFIG: Record<string, TypeMeta> = {
  data: {
    key: "data",
    label: "Database / Migration",
    weight: 3.0,
    color: "bg-rose-600",
    bgColor: "bg-rose-500/10 border-rose-500/20",
    textColor: "text-rose-600 dark:text-rose-400",
    icon: Database,
  },
  infra: {
    key: "infra",
    label: "Infrastructure / CI",
    weight: 2.5,
    color: "bg-purple-600",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    textColor: "text-purple-600 dark:text-purple-400",
    icon: Server,
  },
  dependency: {
    key: "dependency",
    label: "Dependencies",
    weight: 2.0,
    color: "bg-indigo-600",
    bgColor: "bg-indigo-500/10 border-indigo-500/20",
    textColor: "text-indigo-600 dark:text-indigo-400",
    icon: Package,
  },
  config: {
    key: "config",
    label: "Configuration",
    weight: 1.5,
    color: "bg-amber-500",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    textColor: "text-amber-600 dark:text-amber-400",
    icon: Sliders,
  },
  code: {
    key: "code",
    label: "Source Code",
    weight: 1.0,
    color: "bg-blue-500",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    textColor: "text-blue-600 dark:text-blue-400",
    icon: Code2,
  },
};

export function AstRiskBreakdownBar({
  activeTypes = [],
  className = "",
  showLabels = true,
}: AstRiskBreakdownBarProps) {
  const segments = useMemo(() => {
    if (!activeTypes || activeTypes.length === 0) {
      return [
        {
          key: "code",
          label: "Standard Code",
          pct: 100,
          color: "bg-slate-300 dark:bg-slate-700",
          textColor: "text-muted-foreground",
          bgColor: "bg-muted/40 border-border",
          icon: Code2,
        },
      ];
    }

    const matched = activeTypes.map((t) => {
      const lower = t.toLowerCase();
      return (
        TYPE_CONFIG[lower] || {
          key: lower,
          label: t,
          weight: 1.0,
          color: "bg-blue-500",
          bgColor: "bg-blue-500/10 border-blue-500/20",
          textColor: "text-blue-600 dark:text-blue-400",
          icon: Code2,
        }
      );
    });

    const totalWeight = matched.reduce((acc, curr) => acc + curr.weight, 0);

    return matched.map((m) => ({
      ...m,
      pct: Math.max(5, (m.weight / totalWeight) * 100),
    }));
  }, [activeTypes]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Segmented Risk Bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
        {segments.map((seg) => (
          <div
            key={seg.key}
            style={{ width: `${seg.pct}%` }}
            className={`h-full ${seg.color} first:rounded-l-full last:rounded-r-full transition-all duration-300 hover:opacity-90`}
            title={`${seg.label} (weight: ${seg.pct.toFixed(0)}%)`}
          />
        ))}
      </div>

      {/* Legend & Breakdown Pills */}
      {showLabels && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {activeTypes.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">
              No risk modifiers triggered (Standard Baseline)
            </span>
          ) : (
            segments.map((seg) => {
              const Icon = seg.icon;
              return (
                <div
                  key={seg.key}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${seg.bgColor} ${seg.textColor}`}
                >
                  <Icon className="size-3 shrink-0" />
                  <span>{seg.label}</span>
                  <span className="font-mono opacity-75 text-[10px]">
                    {seg.pct.toFixed(0)}%
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
