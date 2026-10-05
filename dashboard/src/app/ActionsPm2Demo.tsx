"use client";

import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, SkipForward, GitBranch, Server, ShieldCheck } from "lucide-react";

type Scenario = "healthy" | "rollback";
type JobStatus = "Waiting" | "Running" | "Success" | "Skipped" | "Failed";
type Frame = {
  title: string; detail: string; log: string; stage: string;
  sha: string; health: string; ci: JobStatus; deploy: JobStatus; rollback: JobStatus; result: JobStatus;
};
const BASE = "a71c902";
const CANDIDATES = { healthy: "b82d013", rollback: "c93e124" };

function framesFor(scenario: Scenario): Frame[] {
  const bad = scenario === "rollback";
  const candidate = CANDIDATES[scenario];
  const initial: Frame = {
    title: "Commit pushed to main", detail: bad ? "A test change makes the health probe return HTTP 503. The application still builds." : "A small application change is ready to deploy.",
    log: `git push origin main → ${candidate}`, stage: "Waiting for CI / deployment", sha: BASE, health: "HTTP 200 · healthy baseline",
    ci: "Waiting", deploy: "Waiting", rollback: "Waiting", result: "Waiting",
  };
  const frames: Frame[] = [initial];
  const add = (frame: Partial<Frame>) => frames.push({ ...frames[frames.length - 1], ...frame });
  add({ title: "GitHub CI checks the commit", detail: "Tests and build checks run before deployment. The healthy baseline continues serving traffic.", log: "CI: install → lint → tests → build", ci: "Running" });
  add({ title: "CI passes · deployment workflow starts", detail: "The successful CI run triggers CARF PM2 Deployment for this exact commit SHA.", log: `workflow_run: CI success → deploy ${candidate}`, ci: "Success", deploy: "Running" });
  add({ title: "CARF classifies and calibrates", detail: "CARF analyzes the diff and returns a policy. This example uses a 4% error ceiling, 45-second observation window, and 60-second startup grace.", log: "Policy ready: code change · error ceiling 4% · observation 45s", stage: "Deploying to PM2" });
  add({ title: "Build and reload PM2", detail: "The server saves the healthy revision, checks out the candidate, installs dependencies, builds, and reloads the PM2 application.", log: `baseline=${BASE} → checkout ${candidate} → build → pm2 reload`, sha: candidate, health: "Starting · health not yet verified" });
  add({ title: "Wait for application health", detail: bad ? "The application starts, but its configured health probe returns 503. CARF waits through startup grace before deciding." : "PM2 is online and the health probe returns 200. CARF can begin observation.", log: `GET /health → HTTP ${bad ? "503" : "200"}`, stage: "Waiting for PM2 health", health: bad ? "HTTP 503 · unhealthy candidate" : "HTTP 200 · candidate ready" });
  if (bad) {
    add({ title: "Startup grace expires · rollback requested", detail: "The probe never passed within the example 60-second grace period. CARF records a rollback request; the deployment job hands it to the separate rollback job.", log: "ROLLBACK_REQUIRED: startup grace expired without passing health check", stage: "Waiting for rollback job", deploy: "Success" });
    add({ title: "GitHub Actions starts the rollback job", detail: "The rollback job calls CARF to execute recovery on the server. Recovery happens inside this same workflow run.", log: `carf-rollback: request restore to ${BASE}`, stage: "Rolling back", rollback: "Running" });
    add({ title: "Restore, rebuild, and reload PM2", detail: "The server restores the recorded healthy revision, rebuilds it, and reloads PM2. A restored SHA alone is not enough: health must pass too.", log: `checkout ${BASE} → rebuild → pm2 reload → verify health`, sha: BASE, health: "Checking restored release" });
    add({ title: "Recovery verified", detail: "CARF verifies the restored revision and a successful health probe. The rollback job completes successfully.", log: `restored=${BASE} · HTTP 200 · rollbackVerified=true`, stage: "Rolled back · recovery verified", health: "HTTP 200 · healthy baseline restored", rollback: "Success" });
    add({ title: "Release rejected · service recovered", detail: "The result job intentionally fails because the new release was rejected. The green rollback job confirms successful recovery; the overall deployment run is red.", log: "Deployment rejected; rollback job result: success", result: "Failed" });
  } else {
    add({ title: "Observe the candidate", detail: "After readiness, CARF monitors error samples for the full observation window. In this example the error rate remains at 0%, below the 4% ceiling.", log: "OBSERVING: error rate 0% / ceiling 4% · example window 45s", stage: "Observing" });
    add({ title: "Observation passes · promote", detail: "The observation window completes without a breach. CARF promotes the candidate and leaves that revision running.", log: `SUCCESS: ${candidate} promoted`, stage: "Promoted", deploy: "Success", rollback: "Skipped" });
    add({ title: "Deployment succeeds", detail: "The result job succeeds. No rollback is needed, and the new release remains healthy on PM2.", log: `Deployment accepted · current SHA ${candidate} · HTTP 200`, result: "Success" });
  }
  return frames;
}

const FRAMES = { healthy: framesFor("healthy"), rollback: framesFor("rollback") };
const STATUS_STYLE: Record<JobStatus, string> = {
  Waiting: "text-muted-foreground", Running: "text-amber-600 dark:text-amber-400",
  Success: "text-emerald-600 dark:text-emerald-400", Skipped: "text-muted-foreground", Failed: "text-rose-600 dark:text-rose-400",
};

export function ActionsPm2Demo() {
  const [scenario, setScenario] = useState<Scenario>("healthy");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1800);
  const frames = FRAMES[scenario];
  const frame = frames[step];
  const finished = step === frames.length - 1;

  useEffect(() => {
    if (!playing || finished) return;
    const timer = setTimeout(() => setStep((value) => value + 1), speed);
    return () => clearTimeout(timer);
  }, [playing, finished, step, speed]);

  function selectScenario(value: Scenario) {
    setPlaying(false);
    setStep(0);
    setScenario(value);
  }

  return (
    <section id="actions-pm2-demo" aria-labelledby="demo-title" className="mt-14 scroll-mt-24 text-left">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Interactive walkthrough</p>
          <h2 id="demo-title" className="mt-2 text-2xl font-semibold tracking-tight">One commit. Every deployment decision.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Follow GitHub Actions, CARF, and PM2 through promotion or verified rollback.</p>
        </div>
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs">Simulation · accelerated time</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/30 p-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Demo scenario">
            {(["healthy", "rollback"] as const).map((value) => <button key={value} type="button" aria-pressed={scenario === value} onClick={() => selectScenario(value)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${scenario === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{value === "healthy" ? "Healthy commit" : "Unhealthy commit → rollback"}</button>)}
          </div>
          <span className="font-mono text-xs text-muted-foreground">main · {CANDIDATES[scenario]}</span>
        </div>
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Step {step + 1} of {frames.length}</span><span>{finished ? "Complete" : playing ? "Playing" : "Paused"}</span></div>
            <progress className="mt-2 h-1.5 w-full accent-indigo-500" value={step + 1} max={frames.length} aria-label="Demo progress" />
            <div className="mt-5 min-h-36" aria-live="polite" aria-atomic="true">
              <h3 className="text-lg font-semibold">{frame.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{frame.detail}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { if (finished) { setStep(0); setPlaying(true); } else setPlaying(!playing); }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{playing && !finished ? <Pause className="size-4" /> : <Play className="size-4" />}{finished ? "Replay" : playing ? "Pause" : "Play demo"}</button>
              <button type="button" disabled={finished} onClick={() => { setPlaying(false); setStep(step + 1); }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"><SkipForward className="size-4" />Next</button>
              <button type="button" aria-label="Reset demo" onClick={() => { setPlaying(false); setStep(0); }} className="rounded-lg border border-border p-2.5"><RotateCcw className="size-4" /></button>
              <label className="ml-auto text-xs text-muted-foreground">Speed <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="rounded border border-border bg-background p-1.5 text-foreground"><option value={3600}>Slow</option><option value={1800}>Normal</option><option value={900}>Fast</option></select></label>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Illustrative SHAs, policy, and health readings. This demo makes no deployment requests. Real builds and health windows take longer.</p>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><GitBranch className="size-4" />GitHub Actions</h3>
              {([["CI (separate workflow)", frame.ci], ["carf-deploy", frame.deploy], ["Rollback to previous healthy release", frame.rollback], ["Deployment result", frame.result]] as [string, JobStatus][]).map(([name, status]) => <div key={name} className="flex items-center justify-between gap-3 py-1.5 text-xs"><span>{name}</span><span className={`shrink-0 font-semibold ${STATUS_STYLE[status]}`}>{status}</span></div>)}
              <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">Deploy, rollback, and result are jobs in one deployment run.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Server className="size-4" />PM2 host</h3><p className="mt-3 font-mono text-sm">{frame.sha}</p><p className="mt-1 text-xs text-muted-foreground">{frame.health}</p></div>
              <div className="rounded-lg border border-border p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4" />CARF dashboard</h3><p className="mt-3 text-sm font-medium">{frame.stage}</p></div>
            </div>
          </div>
        </div>
        <div className="border-t border-border bg-slate-950 p-4 text-slate-200 sm:px-6">
          <p className="mb-3 text-xs font-semibold text-slate-400">SIMULATED EVENT LOG</p>
          <ol className="space-y-1.5 break-words font-mono text-xs">{frames.slice(Math.max(0, step - 3), step + 1).map((event) => <li key={event.title}><span className="mr-2 text-slate-500">›</span>{event.log}</li>)}</ol>
        </div>
      </div>
    </section>
  );
}
