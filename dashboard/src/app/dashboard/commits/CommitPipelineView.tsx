import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  GitCommitHorizontal,
  Layers,
  Activity,
  Gauge,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { projectPageHref } from "../../../lib/dashboardNav";
import { classifyPath } from "../../../lib/pathClassification";
import { pipelineSteps, rollbackDecision, type RollbackDecisionKind } from "../../../lib/commitPipeline";
import {
  explainComplexity,
  explainMix,
  explainThreshold,
} from "../../../lib/thresholdExplain";
import type { CompareFile } from "../../../adapters/github/compareClient";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";

export interface CommitPipelineData {
  owner: string;
  repo: string;
  sha: string;
  baseSha: string;
  createdAt: Date | string;
  vector: {
    infra: number;
    dependency: number;
    config: number;
    code: number;
    data: number;
    codeComplexity: number;
  } | null;
  threshold: {
    finalThreshold: number;
    finalWindow: number;
    activeTypes: string[];
  } | null;
  rollout: {
    status: "PENDING" | "SUCCESS" | "ROLLED_BACK" | "FAILED";
    reason: string | null;
    rolledBack: boolean;
    startedAt: Date | string;
    finishedAt: Date | string | null;
    samples: { ts: Date | string; errorRate: number }[];
  } | null;
  files: CompareFile[];
  filesError: string | null;
}

const DECISION_STYLE: Record<RollbackDecisionKind, string> = {
  rolled_back: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  observing: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  not_needed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  failed: "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-300",
  no_signal: "border-border bg-muted/40 text-muted-foreground",
  awaiting: "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300",
};

function stepIcon(status: "done" | "current" | "pending" | "skipped") {
  if (status === "done") return <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  if (status === "current") return <Circle className="size-4 shrink-0 text-amber-500 animate-pulse" />;
  if (status === "skipped") return <Circle className="size-4 shrink-0 text-muted-foreground/40" />;
  return <Circle className="size-4 shrink-0 text-muted-foreground/50" />;
}

export function CommitPipelineView(data: CommitPipelineData) {
  const decision = rollbackDecision({
    hasVector: Boolean(data.vector),
    rolloutStatus: data.rollout?.status ?? null,
    reason: data.rollout?.reason ?? null,
  });
  const steps = pipelineSteps({
    hasCommit: true,
    hasVector: Boolean(data.vector),
    hasThreshold: Boolean(data.threshold),
    rolloutStatus: data.rollout?.status ?? null,
  });
  const githubUrl = `https://github.com/${data.owner}/${data.repo}/commit/${data.sha}`;
  const mix = data.vector ? explainMix(data.vector) : [];
  const complexity = data.vector ? explainComplexity(data.vector.codeComplexity) : null;
  const walk =
    data.vector && data.threshold
      ? explainThreshold(data.vector, data.threshold)
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={projectPageHref(data.owner, data.repo)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            {data.owner}/{data.repo}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <GitCommitHorizontal className="size-5 text-primary" />
            <h1 className="font-mono text-xl font-bold text-foreground">{data.sha.slice(0, 7)}</h1>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${DECISION_STYLE[decision.kind]}`}>
              {decision.title}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {data.owner}/{data.repo} · base {data.baseSha.slice(0, 7)} ·{" "}
            {new Date(data.createdAt).toLocaleString()}
          </p>
        </div>
        <a
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
        >
          View on GitHub
        </a>
      </div>

      <div className={`rounded-xl border p-4 ${DECISION_STYLE[decision.kind]}`}>
        <p className="text-sm font-semibold">{decision.title}</p>
        <p className="mt-1 text-xs opacity-90">{decision.detail}</p>
      </div>

      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-max items-stretch">
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-stretch">
              <div className="w-48 shrink-0 rounded-xl border border-border bg-card p-3 shadow-xs">
                <div className="flex items-center gap-2">
                  {stepIcon(step.status)}
                  <span className="text-[11px] font-semibold leading-tight text-foreground">{step.title}</span>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{step.summary}</p>
              </div>
              {index < steps.length - 1 ? (
                <div className="flex w-8 shrink-0 items-center justify-center text-muted-foreground/50">
                  <ChevronRight className="size-4" />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <Card className="min-w-0 flex-1 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Layers className="size-4 text-primary" />
              Classifier 1 — what changed
            </CardTitle>
            <CardDescription className="text-[11px]">
              Mix is classified-file share persisted on this SHA. File rows are GitHub compare{" "}
              {data.baseSha.slice(0, 7)}…{data.sha.slice(0, 7)} (unclassified paths can appear here without a mix bar).
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-3">
            {data.vector ? (
              <div className="flex gap-2 overflow-x-auto">
                {mix.map((item) => (
                  <div
                    key={item.key}
                    className="flex min-w-[7.5rem] flex-1 flex-col rounded-lg border border-border bg-muted/20 p-2"
                  >
                    <div className="flex h-24 items-end rounded bg-muted/40">
                      <div
                        className="w-full rounded-t bg-primary"
                        style={{ height: `${item.share <= 0 ? 2 : Math.min(100, item.share * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] font-semibold capitalize text-foreground">{item.key}</p>
                    <p className="font-mono text-sm font-semibold text-foreground">{(item.share * 100).toFixed(0)}%</p>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{item.why}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No change vector — every file was unclassified or skipped.</p>
            )}

            {data.filesError ? (
              <p className="mt-4 text-xs text-amber-700 dark:text-amber-300">{data.filesError}</p>
            ) : data.files.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">No file list from GitHub for this compare.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[36rem] text-left text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Path</th>
                      <th className="px-3 py-2 font-medium">Dashboard label</th>
                      <th className="px-3 py-2 font-medium">Git status</th>
                      <th className="px-3 py-2 font-medium">+/-</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.files.map((file) => (
                      <tr key={file.filename}>
                        <td className="px-3 py-2 font-mono text-foreground">{file.filename}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="uppercase">
                            {classifyPath(file.filename)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{file.status}</td>
                        <td className="px-3 py-2 font-mono">
                          <span className="text-emerald-600">+{file.additions}</span>{" "}
                          <span className="text-rose-600">−{file.deletions}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 shrink-0 py-4 xl:w-[22rem]">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-4 text-primary" />
              Classifier 2 — code complexity
            </CardTitle>
            <CardDescription className="text-[11px]">
              Structural risk on code/test files only. Shown as 0–100 after dividing the raw score by 50 and capping at 1.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-3 space-y-3">
            {complexity && data.vector ? (
              <>
                <p className="font-mono text-3xl font-semibold text-foreground">
                  {complexity.scoreOutOf100.toFixed(1)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span>
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, complexity.scoreOutOf100)}%` }}
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{complexity.why}</p>
                <ol className="list-decimal space-y-1.5 pl-4 text-[11px] leading-snug text-muted-foreground">
                  {complexity.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No complexity score — classifier 1 produced no vector.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="py-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="size-4 text-primary" />
            Threshold metrics — why these numbers
          </CardTitle>
          <CardDescription className="text-[11px]">
            Ceiling and window come from the mix bars, default bases (or `.carf.yml` overrides), then classifier 2 on the
            ceiling only.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-3">
          {data.threshold && walk ? (
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Error-rate ceiling</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
                  {(data.threshold.finalThreshold * 100).toFixed(2)}%
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{walk.ceilingWhy}</p>
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Soak window</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{data.threshold.finalWindow}s</p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{walk.windowWhy}</p>
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Active types</p>
                <p className="mt-1 text-lg font-semibold capitalize text-foreground">
                  {data.threshold.activeTypes.length > 0 ? data.threshold.activeTypes.join(", ") : "none"}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{walk.activeWhy}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Threshold was not stored for this commit.</p>
          )}
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <RotateCcw className="size-4 text-primary" />
            Observation & rollback
          </CardTitle>
        </CardHeader>
        <CardContent className="mt-3">
          {data.rollout ? (
            <div className="flex flex-wrap gap-6 text-xs">
              <p>
                Status <span className="font-mono font-semibold">{data.rollout.status}</span>
                {data.rollout.rolledBack ? " · rolled back" : ""}
              </p>
              {data.rollout.reason ? <p className="text-muted-foreground">{data.rollout.reason}</p> : null}
              <p className="text-muted-foreground">
                Started {new Date(data.rollout.startedAt).toLocaleString()}
                {data.rollout.finishedAt ? ` · finished ${new Date(data.rollout.finishedAt).toLocaleString()}` : ""}
              </p>
              {data.rollout.samples.length > 0 ? (
                <p className="font-mono text-muted-foreground">
                  Last error rate {(data.rollout.samples[data.rollout.samples.length - 1]!.errorRate * 100).toFixed(2)}% ·{" "}
                  {data.rollout.samples.length} samples
                </p>
              ) : (
                <p className="text-muted-foreground">No error-rate samples recorded yet.</p>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              No standalone observation row for this SHA yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
