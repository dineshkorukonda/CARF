"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export interface OutcomeDayBucket {
  date: string;
  SUCCESS: number;
  ROLLED_BACK: number;
  FAILED: number;
  PENDING: number;
  total: number;
}

interface RolloutOutcomeChartProps {
  data: OutcomeDayBucket[];
}

export function RolloutOutcomeChart({ data }: RolloutOutcomeChartProps) {
  if (!data || data.length === 0 || data.every((d) => d.total === 0)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-center p-6">
        <p className="text-xs font-medium text-foreground">No rollout history recorded</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Deploy a commit with PM2 standalone adapter active to record observation outcomes.
        </p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
          <Bar dataKey="SUCCESS" name="Success" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="ROLLED_BACK" name="Rolled Back" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
          <Bar dataKey="FAILED" name="Adapter Error" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
          <Bar dataKey="PENDING" name="Observing" stackId="a" fill="#eab308" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
