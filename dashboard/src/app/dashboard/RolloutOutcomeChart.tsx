"use client";

import React from "react";
import {
  DashboardAnalyticsHub,
  type OutcomeDayBucket,
  type CommitItemForAnalytics,
  type RolloutItemForAnalytics,
} from "./DashboardAnalyticsHub";

export type { OutcomeDayBucket, CommitItemForAnalytics, RolloutItemForAnalytics };

export interface RolloutOutcomeChartProps {
  data?: OutcomeDayBucket[];
  commits?: CommitItemForAnalytics[];
  rollouts?: RolloutItemForAnalytics[];
  totalRollouts?: number;
  rolledBackCount?: number;
  activePendingCount?: number;
}

export function RolloutOutcomeChart({
  data,
  commits = [],
  rollouts = [],
  totalRollouts = 0,
  rolledBackCount = 0,
  activePendingCount = 0,
}: RolloutOutcomeChartProps) {
  return (
    <DashboardAnalyticsHub
      data={data}
      commits={commits}
      rollouts={rollouts}
      totalRollouts={totalRollouts}
      rolledBackCount={rolledBackCount}
      activePendingCount={activePendingCount}
    />
  );
}
