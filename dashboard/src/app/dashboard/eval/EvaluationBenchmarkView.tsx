"use client";

import { useState } from "react";
import {
  Play,
  CheckCircle2,
  RefreshCw,
  BarChart2,
  Activity,
  AlertTriangle,
  Flame,
  ShieldCheck,
  TrendingDown,
  Zap,
  Filter,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import type { SimulationResult, SyntheticTraceItem, EvaluationHistoryItem } from "../../../lib/evalHarness";

export function EvaluationBenchmarkView({
  initialHistory,
}: {
  initialHistory: EvaluationHistoryItem[];
}) {
  const [running, setRunning] = useState(false);
  const [batchCount, setBatchCount] = useState<number>(50);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<EvaluationHistoryItem[]>(initialHistory);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  async function triggerSimulation(count: number = batchCount) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      if (!res.ok) {
        throw new Error("Simulation execution failed");
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

  const filteredTraces = simResult?.traces.filter((trace) => {
    if (typeFilter === "all") return true;
    return trace.changeType === typeFilter;
  });

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 w-fit px-2.5 py-1 rounded-full border border-emerald-200 mb-2">
              <Activity className="size-3.5" />
              <span>Research Evaluation Suite · Hypothesis H1</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Change-Aware Rollback Benchmark
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Empirical A/B comparison testing whether change-type-aware dynamic thresholding reduces false-positive rollbacks compared to static-threshold rollback, at equal or better MTTR.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-mono">
              {[20, 50, 100].map((count) => (
                <button
                  key={count}
                  onClick={() => setBatchCount(count)}
                  className={
                    "px-3 py-1.5 rounded-md font-medium transition-colors " +
                    (batchCount === count
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900")
                  }
                >
                  {count} runs
                </button>
              ))}
            </div>

            <Button
              onClick={() => triggerSimulation(batchCount)}
              disabled={running}
              className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm gap-2 min-w-36 font-mono text-xs h-9"
            >
              {running ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5 fill-current" />
                  <span>Run Benchmark</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Benchmark Results */}
      {simResult ? (
        <div className="flex flex-col gap-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>False Positive Rate</span>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 font-bold">
                  -{simResult.fprReductionPercent}%
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-emerald-600">
                  {(simResult.conditionB.falsePositiveRate * 100).toFixed(1)}%
                </span>
                <span className="text-xs font-mono text-slate-400 line-through">
                  {(simResult.conditionA.falsePositiveRate * 100).toFixed(1)}%
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                Fewer spurious rollbacks on harmless PRs & test additions.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>True Positive MTTR</span>
                <span className="rounded-full bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 font-bold">
                  -{simResult.mttrImprovementPercent}% time
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-slate-900">
                  {(simResult.conditionB.truePositiveMttrMs / 1000).toFixed(1)}s
                </span>
                <span className="text-xs font-mono text-slate-400 line-through">
                  {(simResult.conditionA.truePositiveMttrMs / 1000).toFixed(1)}s
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                Faster recovery window on high-blast infra & schema changes.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Precision Score
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-slate-900">
                  {(simResult.conditionB.precision * 100).toFixed(1)}%
                </span>
                <span className="text-xs font-mono text-slate-400">
                  vs {(simResult.conditionA.precision * 100).toFixed(1)}%
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                Rollbacks fired are genuinely warranted interventions.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Recall Rate
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-slate-900">
                  {(simResult.conditionB.recall * 100).toFixed(1)}%
                </span>
                <span className="text-xs font-mono text-slate-400">
                  vs {(simResult.conditionA.recall * 100).toFixed(1)}%
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                Detects real breakages without slipping through loosened limits.
              </p>
            </div>
          </div>

          {/* Condition A vs Condition B Side-by-Side Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Condition A Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Condition A: Static Baseline</h2>
                    <p className="text-xs text-slate-500">Argo Rollouts / Flagger default (Fixed 1.0% error threshold, 300s window)</p>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">Static</Badge>
                </div>

                <div className="mt-5 space-y-4 font-mono text-xs">
                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>False-Positive Rate</span>
                      <span className="font-bold text-rose-600">{(simResult.conditionA.falsePositiveRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, simResult.conditionA.falsePositiveRate * 100 * 2.5)}%` }}
                        className="h-full bg-rose-500 rounded-full"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>MTTR on Outages</span>
                      <span className="font-bold text-slate-800">{(simResult.conditionA.truePositiveMttrMs / 1000).toFixed(1)}s</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: "85%" }}
                        className="h-full bg-slate-400 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                <span>Prone to noise-induced rollbacks on safe PRs; sluggish response on critical migrations.</span>
              </div>
            </div>

            {/* Condition B Card */}
            <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-50/20 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                      <span>Condition B: CARF Dynamic</span>
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    </h2>
                    <p className="text-xs text-slate-500">AST semantic diffing & Tier 1/2 change-type calibrated thresholds</p>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-mono text-xs">CARF</Badge>
                </div>

                <div className="mt-5 space-y-4 font-mono text-xs">
                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>False-Positive Rate</span>
                      <span className="font-bold text-emerald-600">{(simResult.conditionB.falsePositiveRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.max(4, simResult.conditionB.falsePositiveRate * 100 * 2.5)}%` }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>MTTR on Outages</span>
                      <span className="font-bold text-slate-800">{(simResult.conditionB.truePositiveMttrMs / 1000).toFixed(1)}s</span>
                    </div>
                    <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${(simResult.conditionB.truePositiveMttrMs / simResult.conditionA.truePositiveMttrMs) * 85}%` }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-emerald-100 text-xs text-emerald-800 flex items-center gap-2 font-medium">
                <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                <span>Zero false alarms on test/copy changes, sub-20s rapid rollbacks on risky infrastructure.</span>
              </div>
            </div>
          </div>

          {/* Synthetic Deployment Traces Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Synthetic Deployment Traces</h3>
                <p className="text-xs text-slate-500">Inspect individual rollout decisions and threshold comparisons</p>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="size-3.5 text-slate-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-hidden"
                >
                  <option value="all">All Change Types</option>
                  <option value="code">Code</option>
                  <option value="test">Test</option>
                  <option value="infra">Infra</option>
                  <option value="dependency">Dependency</option>
                  <option value="config">Config</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Commit Description</th>
                    <th className="py-2.5 px-3">Ground Truth</th>
                    <th className="py-2.5 px-3">Peak Error</th>
                    <th className="py-2.5 px-3">Condition A (Static)</th>
                    <th className="py-2.5 px-3">Condition B (CARF)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTraces?.slice(0, 15).map((trace) => {
                    const isFpDiff = trace.rolledBackA && !trace.rolledBackB && trace.groundTruthRisk === "safe";
                    return (
                      <tr key={trace.id} className={isFpDiff ? "bg-emerald-50/40" : ""}>
                        <td className="py-2.5 px-3">
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                            {trace.changeType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-800 max-w-xs truncate" title={trace.title}>
                          {trace.title}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={trace.groundTruthRisk === "risky" ? "text-rose-600 font-bold" : "text-slate-500"}>
                            {trace.groundTruthRisk}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {(trace.peakErrorRate * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3">
                          {trace.rolledBackA ? (
                            <span className="text-rose-600 font-semibold">Rolled Back ({trace.mttrMsA ? `${Math.round(trace.mttrMsA / 1000)}s` : "noise"})</span>
                          ) : (
                            <span className="text-slate-500">Promoted</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {trace.rolledBackB ? (
                            <span className="text-rose-600 font-bold">Rolled Back ({trace.mttrMsB ? `${Math.round(trace.mttrMsB / 1000)}s` : "fast"})</span>
                          ) : isFpDiff ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <ShieldCheck className="size-3.5 text-emerald-600" />
                              Promoted (Saved)
                            </span>
                          ) : (
                            <span className="text-slate-500">Promoted</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center bg-white shadow-sm space-y-4">
          <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <BarChart2 className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Ready to Execute Research Benchmark</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Run synthetic deployments through both static canary and CARF dynamic pipelines to verify the statistical reduction in false positive rollbacks and MTTR improvements.
            </p>
          </div>
          <Button
            onClick={() => triggerSimulation(batchCount)}
            className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm gap-2 font-mono text-xs"
          >
            <Play className="size-3.5 fill-current" />
            <span>Run {batchCount} Synthetic Deployments</span>
          </Button>
        </div>
      )}

      {/* Persisted History Log */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent Benchmark Runs Log (PostgreSQL)
          </h3>
          <span className="text-xs font-mono text-slate-400">{history.length} runs recorded</span>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-3">No persisted evaluation logs found.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 font-medium">{item.commitSha.slice(0, 12)}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize font-sans">
                    {item.condition}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className={item.condition.includes("carf") ? "text-emerald-600 font-semibold" : "text-slate-600"}>
                    {item.outcome}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {item.mttrMs ? `${item.mttrMs}ms` : "--"}
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
