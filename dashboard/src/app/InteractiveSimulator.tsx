"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Film,
  Server,
  Terminal,
  GitPullRequest,
  Activity,
  GitCommit,
  Cpu,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

type ScenarioKey = "infra" | "config" | "dependency" | "code";
type TargetRuntime = "pm2" | "kubernetes" | "gitops";

interface Scenario {
  key: ScenarioKey;
  title: string;
  category: string;
  categoryBadgeColor: string;
  sensitivity: string;
  window: string;
  threshold: number;
  simulatedError: number;
  breaches: boolean;
  commitSha: string;
  commitMsg: string;
  file: string;
  diffSnippet: string;
  tier1: string;
  tier2: string;
  reason: string;
}

const SCENARIOS: Record<ScenarioKey, Scenario> = {
  infra: {
    key: "infra",
    title: "Ingress YAML edit",
    category: "INFRASTRUCTURE",
    categoryBadgeColor: "bg-red-500/15 text-red-400 border-red-500/30",
    sensitivity: "Strictest (P0)",
    window: "60 seconds",
    threshold: 1.0,
    simulatedError: 1.85,
    breaches: true,
    commitSha: "8f2a1b9",
    commitMsg: "fix(ingress): rewrite routing paths for API v2",
    file: "k8s/ingress.yaml",
    diffSnippet: "--- a/k8s/ingress.yaml\n+++ b/k8s/ingress.yaml\n- path: /api/v1\n+ path: /api/v2",
    tier1: "Matches k8s/*.yaml pattern",
    tier2: "Ingress routing rule change detected",
    reason: "Routing path changes can cause immediate total outage; v1 infra ceiling is 1.00% over 60s.",
  },
  config: {
    key: "config",
    title: "DB pool increase",
    category: "CONFIG",
    categoryBadgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    sensitivity: "Medium",
    window: "5 minutes",
    threshold: 5.0,
    simulatedError: 1.25,
    breaches: false,
    commitSha: "4c7e902",
    commitMsg: "chore(env): scale database connection pool for peak traffic",
    file: "config/production.env",
    diffSnippet: "--- a/config/production.env\n+++ b/config/production.env\n- DATABASE_POOL_MAX=20\n+ DATABASE_POOL_MAX=5000",
    tier1: "Matches config/*.env pattern",
    tier2: "Scalar numeric environment variable update",
    reason: "Pool sizing can induce mild contention; v1 config ceiling is 5.00% over 5 minutes.",
  },
  dependency: {
    key: "dependency",
    title: "Session library bump",
    category: "DEPENDENCY",
    categoryBadgeColor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    sensitivity: "High",
    window: "3 minutes",
    threshold: 3.0,
    simulatedError: 3.80,
    breaches: true,
    commitSha: "2b510ea",
    commitMsg: "bump(auth): express-session 1.17 -> 2.0-rc",
    file: "package.json",
    diffSnippet: "--- a/package.json\n+++ b/package.json\n- \"express-session\": \"1.17.3\"\n+ \"express-session\": \"2.0.0-rc1\"",
    tier1: "Matches package.json / lockfiles",
    tier2: "Major semver increment across auth/crypto boundary",
    reason: "Major breaking dependency bump in auth middleware; v1 dependency ceiling is 3.00% over 3 minutes.",
  },
  code: {
    key: "code",
    title: "Response schema fix",
    category: "CODE",
    categoryBadgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    sensitivity: "Standard",
    window: "15 minutes",
    threshold: 8.0,
    simulatedError: 0.65,
    breaches: false,
    commitSha: "9d34c11",
    commitMsg: "refactor(user): align response status format with frontend",
    file: "src/controllers/user.ts",
    diffSnippet: "--- a/src/controllers/user.ts\n+++ b/src/controllers/user.ts\n- return res.json({ status: \"ok\" });\n+ return res.json({ status: \"success\" });",
    tier1: "Matches src/**/*.ts code pattern",
    tier2: "Non-critical payload serialization update",
    reason: "Standard code refactor; v1 code ceiling is 8.00% over 15 minutes to avoid noisy false-alarm rollbacks.",
  },
};

const RUNTIMES: Record<
  TargetRuntime,
  { label: string; badge: string; icon: typeof Server; command: string; note?: string }
> = {
  pm2: {
    label: "PM2",
    badge: "Standalone (Live)",
    icon: Terminal,
    command: "pm2 reload api-server --update-env",
    note: "CARF Standalone adapter executes zero-downtime cluster reload directly.",
  },
  kubernetes: {
    label: "Kubernetes",
    badge: "Augment API live",
    icon: Server,
    command: "GET /v1/augment/threshold?owner=…&repo=…&sha=…",
    note: "No standalone Kubernetes adapter yet. Query the live augment endpoint from your canary controller.",
  },
  gitops: {
    label: "GitOps / Argo",
    badge: "Augment API live",
    icon: GitPullRequest,
    command: "GET /v1/augment/threshold?owner=…&repo=…&sha=…",
    note: "Argo keeps its own rollback. CARF supplies the per-commit threshold; first-party AnalysisTemplate wiring is still an example, not a managed install.",
  },
};

const STEPS = [
  { id: 1, label: "Commit Hook", short: "Push" },
  { id: 2, label: "AST Classifier", short: "Classify" },
  { id: 3, label: "Threshold Calibration", short: "Calibrate" },
  { id: 4, label: "Canary Telemetry", short: "Canary" },
  { id: 5, label: "Decision Engine", short: "Decision" },
];

export function InteractiveSimulator() {
  const [activeTab, setActiveTab] = useState<"video" | "sandbox">("video");
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("infra");
  const [selectedRuntime, setSelectedRuntime] = useState<TargetRuntime>("pm2");

  // Video walkthrough state
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sandbox state
  const [manualErrorRate, setManualErrorRate] = useState<number>(0.45);

  const scenario = SCENARIOS[selectedScenario];
  const runtime = RUNTIMES[selectedRuntime];

  // Video autoplay stepper loop
  useEffect(() => {
    if (activeTab !== "video" || !isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalTime = 60; // ms ticks
    const stepDuration = 2200; // ms per step
    const increment = (intervalTime / stepDuration) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setStepIndex((s) => (s + 1) % STEPS.length);
          return 0;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTab, isPlaying]);

  const handleStepClick = (index: number) => {
    setStepIndex(index);
    setProgress(0);
  };

  const handleReset = () => {
    setStepIndex(0);
    setProgress(0);
    setIsPlaying(true);
  };

  const currentErrorRate =
    activeTab === "video"
      ? stepIndex >= 3
        ? scenario.simulatedError
        : 0.05
      : manualErrorRate;

  const isBreached = currentErrorRate > scenario.threshold;

  // Logs stream generator
  const terminalLogs = useMemo(() => {
    const time = "10:42:15";
    if (activeTab === "video") {
      const logs = [
        `[${time}] [webhook] push origin/main -> commit ${scenario.commitSha} (${scenario.file})`,
      ];
      if (stepIndex >= 1) {
        logs.push(`[${time}] [classifier] Tier 1: ${scenario.tier1} -> Category: ${scenario.category}`);
        logs.push(`[${time}] [classifier] Tier 2 AST: ${scenario.tier2}`);
      }
      if (stepIndex >= 2) {
        logs.push(`[${time}] [calibrator] Calibrated threshold: ${scenario.threshold.toFixed(2)}% HTTP 5xx | Window: ${scenario.window}`);
      }
      if (stepIndex >= 3) {
        logs.push(`[${time}] [metrics] Ingesting canary telemetry: 5xx error rate = ${currentErrorRate.toFixed(2)}%`);
      }
      if (stepIndex >= 4) {
        if (scenario.breaches) {
          logs.push(`[${time}] [BREACH] Rate ${currentErrorRate.toFixed(2)}% > ceiling ${scenario.threshold.toFixed(2)}%!`);
          logs.push(`[${time}] [action] Rollback dispatched: ${runtime.command}`);
        } else {
          logs.push(`[${time}] [PASS] Rate ${currentErrorRate.toFixed(2)}% within budget ${scenario.threshold.toFixed(2)}%`);
          logs.push(`[${time}] [canary] Advancing rollout to 100% healthy.`);
        }
      }
      return logs;
    } else {
      // Sandbox mode logs
      const base = [
        `[${time}] Target repo: acme/production-service [${scenario.category}]`,
        `[${time}] Dynamic Threshold: ${scenario.threshold.toFixed(2)}% | Observation Window: ${scenario.window}`,
        `[${time}] Current Error Reading: ${manualErrorRate.toFixed(2)}%`,
      ];
      if (isBreached) {
        base.push(`[${time}] [ALERT] BREACH DETECTED: Action: "${runtime.command}"`);
      } else {
        base.push(`[${time}] [OK] HEALTHY: Within error-rate threshold.`);
      }
      return base;
    }
  }, [activeTab, stepIndex, scenario, currentErrorRate, isBreached, runtime.command, manualErrorRate]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-foreground">
      {/* Top Header & Mode Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border bg-muted/40 px-5 py-3.5 gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            CARF Pipeline Simulator
          </span>
          <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 border-border">
            Interactive
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-background/80 p-0.5 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("video")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === "video"
                ? "bg-accent text-accent-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Film className="size-3.5" />
            <span>Video Walkthrough</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sandbox")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTab === "sandbox"
                ? "bg-accent text-accent-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sliders className="size-3.5" />
            <span>Live Sandbox</span>
          </button>
        </div>
      </div>

      {/* Main Simulator Layout Grid */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Scenario Controls */}
        <div className="lg:col-span-7 space-y-4">
          {/* Scenario Selector Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Select Diff Profile:</span>
              <span className="text-[11px] font-mono text-muted-foreground/80">Simulating AST & T1 Path Rules</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(SCENARIOS) as ScenarioKey[]).map((sKey) => {
                const item = SCENARIOS[sKey];
                const isSelected = selectedScenario === sKey;
                return (
                  <button
                    key={sKey}
                    type="button"
                    onClick={() => {
                      setSelectedScenario(sKey);
                      if (activeTab === "sandbox") {
                        setManualErrorRate(item.simulatedError);
                      }
                      setStepIndex(0);
                      setProgress(0);
                    }}
                    className={`flex flex-col text-left p-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? "border-foreground bg-accent text-accent-foreground shadow-2xs"
                        : "border-border bg-background/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <span className="text-xs font-semibold truncate text-foreground">{item.title}</span>
                    <span className="text-[10px] font-mono mt-0.5 opacity-80">{item.category}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Diff Preview Card */}
          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <GitCommit className="size-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs font-bold text-foreground">commit {scenario.commitSha}</span>
                  <Badge variant="outline" className={`text-[10px] uppercase font-mono px-1.5 py-0 ${scenario.categoryBadgeColor}`}>
                    {scenario.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-sans line-clamp-1">{scenario.commitMsg}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Budget Ceiling</div>
                <div className="text-sm font-bold font-mono text-foreground">{scenario.threshold.toFixed(2)}%</div>
              </div>
            </div>

            {/* Code Diff Block */}
            <div className="rounded bg-muted/60 p-2.5 font-mono text-xs overflow-x-auto border border-border/40">
              <div className="text-[11px] text-muted-foreground mb-1 select-none font-semibold">
                Target: {scenario.file}
              </div>
              <pre className="text-[11px] leading-relaxed text-foreground select-all">
                {scenario.diffSnippet}
              </pre>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
              <div>
                <span className="text-muted-foreground font-mono text-[10px] uppercase block">Tier 1 Path Rule:</span>
                <span className="text-xs text-foreground font-mono font-medium">{scenario.tier1}</span>
              </div>
              <div>
                <span className="text-muted-foreground font-mono text-[10px] uppercase block">Tier 2 AST Classification:</span>
                <span className="text-xs text-foreground font-mono font-medium">{scenario.tier2}</span>
              </div>
            </div>
          </div>

          {/* Stepper (Video Walkthrough Mode) */}
          {activeTab === "video" ? (
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="size-7 p-0 shrink-0"
                  >
                    {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleReset}
                    className="size-7 p-0 shrink-0 text-muted-foreground"
                    title="Restart Simulation"
                  >
                    <RotateCcw className="size-3" />
                  </Button>
                  <span className="text-xs font-semibold text-foreground">
                    Step {stepIndex + 1} of {STEPS.length}: {STEPS[stepIndex].label}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">Auto-Walkthrough</span>
              </div>

              {/* Step indicator bar */}
              <div className="grid grid-cols-5 gap-1.5">
                {STEPS.map((s, idx) => {
                  const isCurrent = idx === stepIndex;
                  const isPassed = idx < stepIndex;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleStepClick(idx)}
                      className="group relative flex flex-col text-left focus:outline-hidden"
                    >
                      <div className="h-1.5 w-full rounded-sm bg-muted overflow-hidden">
                        <div
                          className={`h-full transition-all duration-75 ${
                            isPassed
                              ? "bg-foreground"
                              : isCurrent
                              ? "bg-foreground"
                              : "bg-transparent"
                          }`}
                          style={{
                            width: isPassed ? "100%" : isCurrent ? `${progress}%` : "0%",
                          }}
                        />
                      </div>
                      <span className={`text-[10px] mt-1 font-mono truncate ${
                        isCurrent ? "font-bold text-foreground" : "text-muted-foreground"
                      }`}>
                        {s.short}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Live Sandbox Slider Control */
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Activity className="size-3.5 text-foreground" />
                  Simulate Live Telemetry Spike:
                </span>
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  isBreached ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
                }`}>
                  {manualErrorRate.toFixed(2)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="10.0"
                step="0.05"
                value={manualErrorRate}
                onChange={(e) => setManualErrorRate(parseFloat(e.target.value))}
                className="w-full cursor-pointer accent-foreground"
              />
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>0.00%</span>
                <span className="text-foreground font-medium">
                  Threshold: {scenario.threshold.toFixed(2)}%
                </span>
                <span>10.00%</span>
              </div>
            </div>
          )}

          {/* Target Runtime Selector */}
          <div className="rounded-lg border border-border bg-background p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Cpu className="size-3.5 text-foreground" />
                Target Rollback Driver:
              </span>
              <span className="text-[11px] text-muted-foreground">PM2 executes rollback; other targets use the live augment API</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(RUNTIMES) as TargetRuntime[]).map((rKey) => {
                const item = RUNTIMES[rKey];
                const Icon = item.icon;
                const isSelected = selectedRuntime === rKey;
                return (
                  <button
                    key={rKey}
                    type="button"
                    onClick={() => setSelectedRuntime(rKey)}
                    className={`flex items-center justify-between p-2 rounded-md border text-xs transition-all ${
                      isSelected
                        ? "border-foreground bg-accent text-accent-foreground font-semibold"
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Icon className="size-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0 ml-1">
                      {item.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Decision Stream & Telemetry */}
        <div className="lg:col-span-5 space-y-4">
          {/* Decision Outcome Card */}
          <div className={`rounded-lg border p-4 transition-all duration-300 ${
            isBreached
              ? "border-red-500/50 bg-red-500/10 shadow-xs"
              : "border-emerald-500/50 bg-emerald-500/10 shadow-xs"
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {isBreached ? (
                  <ShieldAlert className="size-5 text-red-500 shrink-0" />
                ) : (
                  <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
                )}
                <div>
                  <h4 className="text-sm font-semibold">
                    {isBreached ? "Automated Rollback Triggered" : "Deployment Healthy"}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isBreached
                      ? `Error rate (${currentErrorRate.toFixed(2)}%) exceeded threshold (${scenario.threshold.toFixed(2)}%)`
                      : `Error rate (${currentErrorRate.toFixed(2)}%) within ${scenario.category} budget (${scenario.threshold.toFixed(2)}%)`}
                  </p>
                </div>
              </div>
              <Badge variant={isBreached ? "destructive" : "default"} className="text-[10px] font-mono shrink-0">
                {isBreached ? "< 380ms" : "STABLE"}
              </Badge>
            </div>

            {/* Threshold & Observation Window stats */}
            <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Calculated Ceiling:</span>
                <span className="font-bold text-foreground">{scenario.threshold.toFixed(2)}% HTTP 5xx</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Telemetry Window:</span>
                <span className="font-bold text-foreground">{scenario.window}</span>
              </div>
            </div>
          </div>

          {/* Action Dispatched Command */}
          <div className="rounded-lg border border-border bg-background p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground uppercase text-[10px]">
                {selectedRuntime === "pm2" ? "Automated Runtime Command:" : "Runtime Integration Status:"}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Driver: {runtime.label} ({runtime.badge})
              </span>
            </div>
            <div className="rounded bg-muted p-2.5 font-mono text-xs text-foreground overflow-x-auto select-all">
              {isBreached ? runtime.command : "# monitoring… within tolerance, no rollback needed"}
            </div>
            {runtime.note && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {runtime.note}
              </p>
            )}
          </div>

          {/* Live Pipeline Terminal Audit Log */}
          <div className="rounded-lg border border-border bg-background p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
                <Terminal className="size-3" />
                Live Decision Stream
              </span>
              <span className="size-1.5 rounded-full bg-emerald-500" />
            </div>
            <div className="space-y-1 font-mono text-[11px] text-muted-foreground/90 max-h-48 overflow-y-auto leading-relaxed">
              {terminalLogs.map((log, idx) => (
                <div key={idx} className="border-l border-border pl-2 py-0.5">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
