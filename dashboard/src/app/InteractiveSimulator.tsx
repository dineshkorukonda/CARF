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
  Box,
  GitPullRequest,
  Activity,
  GitCommit,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  FastForward,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

type ScenarioKey = "infra" | "config" | "dependency" | "code";
type TargetRuntime = "kubernetes" | "pm2" | "docker" | "gitops";

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
    threshold: 0.2,
    simulatedError: 0.48,
    breaches: true,
    commitSha: "8f2a1b9",
    commitMsg: "fix(ingress): rewrite routing paths for API v2",
    file: "k8s/ingress.yaml",
    diffSnippet: "--- a/k8s/ingress.yaml\n+++ b/k8s/ingress.yaml\n- path: /api/v1\n+ path: /api/v2",
    tier1: "Matches k8s/*.yaml pattern",
    tier2: "Ingress routing rule change detected",
    reason: "Routing path changes can cause immediate total outage; zero-tolerance 0.20% ceiling applied.",
  },
  config: {
    key: "config",
    title: "DB pool increase",
    category: "CONFIG",
    categoryBadgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    sensitivity: "Medium",
    window: "5 minutes",
    threshold: 2.5,
    simulatedError: 1.25,
    breaches: false,
    commitSha: "4c7e902",
    commitMsg: "chore(env): scale database connection pool for peak traffic",
    file: "config/production.env",
    diffSnippet: "--- a/config/production.env\n+++ b/config/production.env\n- DATABASE_POOL_MAX=20\n+ DATABASE_POOL_MAX=5000",
    tier1: "Matches config/*.env pattern",
    tier2: "Scalar numeric environment variable update",
    reason: "Pool sizing can induce mild contention; calibrated to 2.50% error ceiling over 5m window.",
  },
  dependency: {
    key: "dependency",
    title: "Session library bump",
    category: "DEPENDENCY",
    categoryBadgeColor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    sensitivity: "High",
    window: "3 minutes",
    threshold: 1.0,
    simulatedError: 1.85,
    breaches: true,
    commitSha: "2b510ea",
    commitMsg: "bump(auth): express-session 1.17 -> 2.0-rc",
    file: "package.json",
    diffSnippet: "--- a/package.json\n+++ b/package.json\n- \"express-session\": \"1.17.3\"\n+ \"express-session\": \"2.0.0-rc1\"",
    tier1: "Matches package.json / lockfiles",
    tier2: "Major semver increment across auth/crypto boundary",
    reason: "Major breaking dependency bump in auth middleware; threshold restricted to 1.00%.",
  },
  code: {
    key: "code",
    title: "Response schema fix",
    category: "CODE",
    categoryBadgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    sensitivity: "Standard",
    window: "15 minutes",
    threshold: 5.0,
    simulatedError: 0.65,
    breaches: false,
    commitSha: "9d34c11",
    commitMsg: "refactor(user): align response status format with frontend",
    file: "src/controllers/user.ts",
    diffSnippet: "--- a/src/controllers/user.ts\n+++ b/src/controllers/user.ts\n- return res.json({ status: \"ok\" });\n+ return res.json({ status: \"success\" });",
    tier1: "Matches src/**/*.ts code pattern",
    tier2: "Non-critical payload serialization update",
    reason: "Standard code refactor; generous 5.00% ceiling prevents noisy false-alarm rollbacks.",
  },
};

const RUNTIMES: Record<TargetRuntime, { label: string; icon: typeof Server; command: string }> = {
  kubernetes: {
    label: "Kubernetes",
    icon: Server,
    command: "kubectl rollout undo deployment/api-server -n production",
  },
  pm2: {
    label: "PM2",
    icon: Terminal,
    command: "pm2 reload api-server --update-env",
  },
  docker: {
    label: "Docker Compose",
    icon: Box,
    command: "IMAGE_TAG=sha-prev docker compose up -d api",
  },
  gitops: {
    label: "GitOps / Argo",
    icon: GitPullRequest,
    command: "git revert HEAD --no-edit && git push origin main",
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
  const [selectedRuntime, setSelectedRuntime] = useState<TargetRuntime>("kubernetes");

  // Video / Walkthrough Player State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [simulatedProgress, setSimulatedProgress] = useState<number>(0);

  // Manual Sandbox error rate
  const [manualErrorRate, setManualErrorRate] = useState<number>(0.48);

  const scenario = SCENARIOS[selectedScenario];
  const runtime = RUNTIMES[selectedRuntime];

  // Auto-play timer for video walkthrough mode
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (activeTab !== "video" || !isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.round(2400 / playbackSpeed);

    timerRef.current = setInterval(() => {
      setStepIndex((prev) => {
        const next = (prev + 1) % STEPS.length;
        setSimulatedProgress(Math.round(((next + 1) / STEPS.length) * 100));
        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTab, isPlaying, playbackSpeed]);

  // Sync initial error rate when scenario changes
  function handleSelectScenario(key: ScenarioKey) {
    setSelectedScenario(key);
    setManualErrorRate(SCENARIOS[key].simulatedError);
    setStepIndex(0);
    setSimulatedProgress(20);
  }

  // Determine current active metrics based on tab
  const currentErrorRate = activeTab === "video"
    ? (stepIndex >= 3 ? scenario.simulatedError : 0.05)
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
          logs.push(`[${time}] [action] Rollback dispatched in 340ms: ${runtime.command}`);
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
        base.push(`[${time}] ⚠️ BREACH DETECTED: Dispatched: "${runtime.command}"`);
      } else {
        base.push(`[${time}] ✓ HEALTHY: Within error budget.`);
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
            onClick={() => {
              setActiveTab("video");
              setIsPlaying(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === "video"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Film className="size-3.5" />
            <span>Video Walkthrough</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("sandbox");
              setIsPlaying(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === "sandbox"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sliders className="size-3.5" />
            <span>Manual Sandbox</span>
          </button>
        </div>
      </div>

      {/* Scenario Selection Bar */}
      <div className="border-b border-border bg-background px-5 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground font-medium">Select Deployment Scenario:</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
              const item = SCENARIOS[key];
              const isSelected = selectedScenario === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectScenario(key)}
                  className={`flex flex-col text-left px-2.5 py-1.5 rounded-md border text-xs transition-all ${
                    isSelected
                      ? "border-foreground bg-accent text-accent-foreground font-semibold shadow-2xs"
                      : "border-border bg-card/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {item.category}
                  </span>
                  <span className="truncate">{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Video Mode: Step Timeline & Playback Controller */}
      {activeTab === "video" && (
        <div className="border-b border-border bg-muted/20 px-5 py-3">
          {/* Step Badges */}
          <div className="grid grid-cols-5 gap-1 sm:gap-2 mb-3">
            {STEPS.map((s, idx) => {
              const isCurrent = stepIndex === idx;
              const isPast = stepIndex > idx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStepIndex(idx);
                    setSimulatedProgress(Math.round(((idx + 1) / STEPS.length) * 100));
                    setIsPlaying(false);
                  }}
                  className={`flex flex-col items-center sm:items-start p-1.5 sm:px-2.5 sm:py-2 rounded-md border text-left transition-all ${
                    isCurrent
                      ? "border-foreground bg-background shadow-xs font-semibold"
                      : isPast
                        ? "border-emerald-500/40 bg-emerald-500/5 text-muted-foreground"
                        : "border-border/60 bg-transparent text-muted-foreground/60 hover:text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <span className={`size-1.5 rounded-full ${isCurrent ? "bg-foreground" : isPast ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                    <span className="hidden sm:inline">0{s.id}</span>
                  </div>
                  <span className="text-[11px] truncate w-full text-center sm:text-left mt-0.5">
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Player controls */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {isPlaying ? <Pause className="size-3.5 text-amber-500" /> : <Play className="size-3.5 text-emerald-500 fill-emerald-500" />}
                <span>{isPlaying ? "Pause" : "Play Demo"}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStepIndex(0);
                  setSimulatedProgress(20);
                }}
                className="h-8 size-8 p-0"
                title="Restart Walkthrough"
              >
                <RotateCcw className="size-3.5" />
              </Button>
              <button
                type="button"
                onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1)}
                className="px-2 py-1 rounded border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                title="Toggle playback speed"
              >
                <span className="flex items-center gap-0.5">
                  <FastForward className="size-3" />
                  {playbackSpeed}x
                </span>
              </button>
            </div>

            {/* Scrubber indicator */}
            <div className="flex items-center gap-3 w-40 sm:w-60">
              <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-foreground h-full transition-all duration-300"
                  style={{ width: `${simulatedProgress || Math.round(((stepIndex + 1) / STEPS.length) * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                0{stepIndex + 1} / 05
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Stage */}
      <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Pipeline Architecture Card */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Step Showcase */}
          <div className="rounded-lg border border-border bg-background p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
              <div className="flex items-center gap-2">
                <GitCommit className="size-4 text-muted-foreground" />
                <span className="font-mono text-xs font-semibold">
                  Commit <span className="text-foreground">{scenario.commitSha}</span>: {scenario.title}
                </span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${scenario.categoryBadgeColor}`}>
                {scenario.category}
              </span>
            </div>

            {/* Commit Message & File */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{scenario.commitMsg}</p>
              <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                <span className="px-1.5 py-0.5 rounded bg-muted">File:</span>
                <span className="text-foreground font-semibold">{scenario.file}</span>
              </div>
            </div>

            {/* Parsed Diff Block */}
            <div className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs overflow-x-auto leading-relaxed">
              <pre className="text-muted-foreground">
                {scenario.diffSnippet.split("\n").map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith("+")
                        ? "text-emerald-500 font-medium bg-emerald-500/10 px-1 rounded-xs"
                        : line.startsWith("-")
                          ? "text-red-500 font-medium bg-red-500/10 px-1 rounded-xs"
                          : ""
                    }
                  >
                    {line}
                  </div>
                ))}
              </pre>
            </div>

            {/* Classification explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="rounded border border-border/70 bg-muted/30 p-2 text-[11px]">
                <div className="text-muted-foreground font-medium">Tier 1 Path Filter:</div>
                <div className="font-mono text-foreground mt-0.5">{scenario.tier1}</div>
              </div>
              <div className="rounded border border-border/70 bg-muted/30 p-2 text-[11px]">
                <div className="text-muted-foreground font-medium">Tier 2 AST Structural:</div>
                <div className="font-mono text-foreground mt-0.5">{scenario.tier2}</div>
              </div>
            </div>
          </div>

          {/* Sandbox controls if in sandbox mode */}
          {activeTab === "sandbox" && (
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Activity className="size-3.5 text-blue-500" />
                  Simulated Canary 5xx Error Rate Slider:
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
                max="6.0"
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
                <span>6.00%</span>
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
              <span className="text-[11px] text-muted-foreground">CARF executes zero-downtime reversal</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(RUNTIMES) as TargetRuntime[]).map((rKey) => {
                const item = RUNTIMES[rKey];
                const Icon = item.icon;
                const isSelected = selectedRuntime === rKey;
                return (
                  <button
                    key={rKey}
                    type="button"
                    onClick={() => setSelectedRuntime(rKey)}
                    className={`flex items-center gap-2 p-2 rounded-md border text-xs transition-all ${
                      isSelected
                        ? "border-foreground bg-accent text-accent-foreground font-semibold"
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
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
                Autonomous Runtime Command:
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Driver: {runtime.label}
              </span>
            </div>
            <div className="rounded bg-muted p-2.5 font-mono text-xs text-foreground overflow-x-auto select-all">
              {isBreached ? runtime.command : "# monitoring… within tolerance, no rollback needed"}
            </div>
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
