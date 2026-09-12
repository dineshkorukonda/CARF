"use client";

import { useState } from "react";
import { Play, CheckCircle2, RefreshCw, BarChart2, Activity } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import type { SimulationResult, EvaluationHistoryItem } from "../../../../lib/evalHarness";

export function VerifyDashboard({
  repoName,
  initialHistory,
}: {
  installationId?: string;
  repoName: string;
  initialHistory: EvaluationHistoryItem[];
}) {
  const [running, setRunning] = useState(false);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<EvaluationHistoryItem[]>(initialHistory);
  const [error, setError] = useState<string | null>(null);

  async function triggerSimulation() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/eval/run", { method: "POST" });
      if (!res.ok) {
        throw new Error("Simulation run failed");
      }
      const data: SimulationResult = await res.json();
      setSimResult(data);

      const histRes = await fetch("/api/eval/history");
      if (histRes.ok) {
        const histData = await histRes.json();
        if (histData.history) setHistory(histData.history);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to execute simulation";
      setError(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Activity className="size-3.5 text-primary" />
            <span>Statistical Verification Suite</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground mt-1">
            Offline Evaluation Harness
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Benchmarks CARF change-aware dynamic thresholds (Condition B) directly against static canary defaults (Condition A) for <span className="font-mono text-foreground">{repoName}</span>.
          </p>
        </div>

        <Button
          onClick={triggerSimulation}
          disabled={running}
          className="self-start sm:self-auto gap-2 min-w-36 font-mono text-xs"
        >
          {running ? (
            <>
              <RefreshCw className="size-3.5 animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Play className="size-3.5 fill-current" />
              <span>Run Simulation</span>
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Side-by-Side Benchmark Results */}
      {simResult ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Simulation Results (50 Synthetic Deployments)
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              Executed at {new Date(simResult.createdAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Condition A: Static Baseline */}
            <div className="rounded-sm border border-border bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Condition A: Static Canary</h2>
                  <p className="text-[11px] text-muted-foreground">Argo / Flagger default: 1% fixed threshold, 300s window</p>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">Static</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono">
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">False Positive Rate</div>
                  <div className="text-2xl font-bold text-destructive">
                    {(simResult.conditionA.falsePositiveRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">High noise sensitivity</div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">Avg MTTR</div>
                  <div className="text-2xl font-bold text-foreground">
                    {(simResult.conditionA.truePositiveMttrMs / 1000).toFixed(1)}s
                  </div>
                  <div className="text-[10px] text-muted-foreground">Fixed observation delay</div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">Precision</div>
                  <div className="text-lg font-semibold text-foreground">
                    {(simResult.conditionA.precision * 100).toFixed(1)}%
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">Recall</div>
                  <div className="text-lg font-semibold text-foreground">
                    {(simResult.conditionA.recall * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Condition B: CARF Dynamic */}
            <div className="rounded-sm border border-primary/40 bg-card p-5 space-y-4 shadow-xs ring-1 ring-primary/20">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <span>Condition B: CARF Dynamic</span>
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  </h2>
                  <p className="text-[11px] text-muted-foreground">Change-aware: AST semantic risk & dynamic error budget</p>
                </div>
                <Badge variant="default" className="font-mono text-[10px]">CARF</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono">
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">False Positive Rate</div>
                  <div className="text-2xl font-bold text-emerald-500">
                    {(simResult.conditionB.falsePositiveRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {((simResult.conditionA.falsePositiveRate - simResult.conditionB.falsePositiveRate) * 100).toFixed(1)}% FPR reduction
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">Avg MTTR</div>
                  <div className="text-2xl font-bold text-foreground">
                    {(simResult.conditionB.truePositiveMttrMs / 1000).toFixed(1)}s
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {((simResult.conditionA.truePositiveMttrMs - simResult.conditionB.truePositiveMttrMs) / 1000).toFixed(1)}s faster rollback
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">Precision</div>
                  <div className="text-lg font-semibold text-foreground">
                    {(simResult.conditionB.precision * 100).toFixed(1)}%
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase">Recall</div>
                  <div className="text-lg font-semibold text-foreground">
                    {(simResult.conditionB.recall * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-border p-8 text-center bg-card space-y-3">
          <BarChart2 className="size-8 mx-auto text-muted-foreground opacity-60" />
          <h3 className="text-sm font-semibold text-foreground">No Simulation Run in Current Session</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Click &quot;Run Simulation&quot; to execute synthetic deployments through both static canary and CARF dynamic pipelines and compare false positive rates and MTTR in real-time.
          </p>
        </div>
      )}

      {/* Historical Evaluation Logs */}
      <div className="rounded-sm border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            EvaluationLog History (Postgres)
          </h3>
          <span className="text-xs font-mono text-muted-foreground">{history.length} logged runs</span>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-3">No persisted evaluation logs found.</p>
        ) : (
          <div className="divide-y divide-border border-t border-border mt-2">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{item.commitSha.slice(0, 10)}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize font-sans">
                    {item.condition}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className={item.outcome.includes("positive") ? "text-emerald-500" : "text-muted-foreground"}>
                    {item.outcome}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {item.mttrMs ? item.mttrMs + "ms" : "--"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
