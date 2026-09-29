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
} from "lucide-react";
import { projectPageHref } from "../../../lib/dashboardNav";
import { classifyPath } from "../../../lib/pathClassification";
import { pipelineSteps, rollbackDecision, type RollbackDecisionKind } from "../../../lib/commitPipeline";
import type { CompareFile } from "../../../adapters/github/compareClient";

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

const VECTOR_KEYS = ["infra", "dependency", "config", "code", "data"] as const;

const DECISION_STYLE: Record<RollbackDecisionKind, string> = {
  rolled_back: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  observing: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  not_needed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  failed: "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-300",
  no_signal: "border-border bg-muted/40 text-muted-foreground",
  awaiting: "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300",
};

function stepIcon(status: "done" | "current" | "pending" | "skipped") {
  if (status === "done") return <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />;
  if (status === "current") return <Circle className="size-4 text-amber-500 animate-pulse" />;
  if (status === "skipped") return <Circle className="size-4 text-muted-foreground/40" />;
  return <Circle className="size-4 text-muted-foreground/50" />;
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
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

      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.map((step) => (
          <li key={step.id} className="rounded-xl border border-border bg-card p-3 shadow-xs">
            <div className="flex items-center gap-2">
              {stepIcon(step.status)}
              <span className="text-[11px] font-semibold text-foreground">{step.title}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{step.summary}</p>
          </li>
        ))}
      </ol>

      <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Classifier 1 — what changed</h2>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Path typing (infra / dependency / config / code / data). The stored mix is the vector CARF persisted for this
          SHA; the file list is GitHub compare {data.baseSha.slice(0, 7)}…{data.sha.slice(0, 7)}.
        </p>

        {data.vector ? (
          <div className="mt-4 space-y-2">
            {VECTOR_KEYS.map((key) => {
              const value = data.vector![key];
              return (
                <div key={key} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2 text-xs">
                  <span className="capitalize text-muted-foreground">{key}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value * 100)}%` }} />
                  </div>
                  <span className="font-mono text-right text-foreground">{(value * 100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No change vector — every file was unclassified or skipped.</p>
        )}

        {data.filesError ? (
          <p className="mt-4 text-xs text-amber-700 dark:text-amber-300">{data.filesError}</p>
        ) : data.files.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">No file list from GitHub for this compare.</p>
        ) : (
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {data.files.map((file) => (
              <div key={file.filename} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="font-mono text-foreground">{file.filename}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                    {classifyPath(file.filename)}
                  </span>
                  <span>{file.status}</span>
                  <span className="font-mono text-emerald-600">+{file.additions}</span>
                  <span className="font-mono text-rose-600">−{file.deletions}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Classifier 2 — code complexity</h2>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Tree-sitter AST complexity on code/test files, normalized to 0–1 as <code className="font-mono">codeComplexity</code>.
        </p>
        {data.vector ? (
          <p className="mt-4 font-mono text-2xl font-semibold text-foreground">
            {(data.vector.codeComplexity * 100).toFixed(1)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span>
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No complexity score — classifier 1 produced no vector.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Threshold metrics</h2>
        </div>
        {data.threshold ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <dt className="text-muted-foreground">Error-rate ceiling</dt>
              <dd className="mt-1 font-mono text-lg font-semibold text-foreground">
                {(data.threshold.finalThreshold * 100).toFixed(2)}%
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <dt className="text-muted-foreground">Soak window</dt>
              <dd className="mt-1 font-mono text-lg font-semibold text-foreground">{data.threshold.finalWindow}s</dd>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <dt className="text-muted-foreground">Active types</dt>
              <dd className="mt-1 font-semibold text-foreground">
                {data.threshold.activeTypes.length > 0 ? data.threshold.activeTypes.join(", ") : "none"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Threshold was not stored for this commit.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Observation & rollback</h2>
        </div>
        {data.rollout ? (
          <div className="mt-3 space-y-2 text-xs">
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
          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            No standalone observation row for this SHA yet.
          </div>
        )}
      </section>
    </div>
  );
}
