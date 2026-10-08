"use client";

import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { AnalysisTriggerSchema, type AnalysisTrigger } from "../lib/carfConfigSchema";

export const ANALYSIS_TRIGGER_LABELS: Record<AnalysisTrigger, string> = {
  commits: "Pushed commits",
  pull_requests: "Pull requests",
  both: "Commits and pull requests",
};

export function AnalysisTriggerSelect({ value, onChange, disabled = false }: {
  value: AnalysisTrigger; onChange: (value: AnalysisTrigger) => void; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">Analyze changes from</label>
      <Select value={value} disabled={disabled} onValueChange={(next) => {
        const parsed = AnalysisTriggerSchema.safeParse(next);
        if (parsed.success) onChange(parsed.data);
      }}>
        <SelectTrigger id={id} aria-describedby={`${id}-help`} className="w-full sm:w-72">
          <SelectValue>{ANALYSIS_TRIGGER_LABELS[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ANALYSIS_TRIGGER_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
      <p id={`${id}-help`} className="max-w-xl text-xs text-muted-foreground">
        Choose when CARF automatically calculates change risk. Pull requests use the full PR diff. Deployment checks can still request a commit policy when needed.
      </p>
      {value !== "commits" && <p className="text-xs text-muted-foreground">Enable the Pull request subscription in your GitHub App settings.</p>}
      {value === "pull_requests" && <p className="text-xs text-muted-foreground">PR-only projects deploy through CI. Automatic deployment from push webhooks requires commits to be selected.</p>}
    </div>
  );
}
