import { getCurrentAccount } from "../lib/auth";
import { Button } from "../components/ui/button";
import {
  GitBranch,
  Activity,
  Cpu,
  RotateCcw,
  CheckCircle2,
  Terminal,
} from "lucide-react";
import { InteractiveSimulator } from "./InteractiveSimulator";
import { CompatChecker } from "./CompatChecker";

const STEPS = [
  {
    title: "Sign in with GitHub",
    desc: "Create a CARF account and sign in. No credit card, no install required yet.",
  },
  {
    title: "Install the CARF GitHub App",
    desc: "Grant CARF access to classify commits on the repo(s) you pick — all of them, or a subset.",
  },
  {
    title: "Configure mode & adapter",
    desc: "Standalone mode (live with PM2) has CARF monitor health and execute rollbacks. Augment mode (planned) will supply dynamic threshold recommendations to external deployment controllers via GET /v1/augment/threshold.",
  },
  {
    title: "Set classification & threshold rules",
    desc: "Tune which paths count as code / config / dependency / infra, and how sensitive + how long CARF watches each. Commits straight to your repo's .carf.yml.",
  },
  {
    title: "Wire your pipeline (Augment mode — planned)",
    desc: "In Augment mode, deployment scripts or CI pipelines will query GET /v1/augment/threshold for dynamic thresholds and observation windows. Standalone PM2 mode is live today and needs no pipeline wiring.",
  },
  {
    title: "Watch live status",
    desc: "See classified commits, computed thresholds, and rollout outcomes as they happen.",
  },
];

const PIPELINE_PHASES = [
  { icon: GitBranch, title: "Classify", caption: "Tier 1 path + Tier 2 AST" },
  { icon: Activity, title: "Monitor", caption: "Post-deploy metrics window" },
  { icon: Cpu, title: "Decide", caption: "Change-keyed threshold" },
  { icon: RotateCcw, title: "Roll back", caption: "PM2 / cluster reload" },
];

export default async function HomePage() {
  const account = await getCurrentAccount();

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-xs sticky top-0 z-30">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-tight text-foreground">
              CARF
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              / Change-Aware Rollback Framework
            </span>
          </div>
          <div className="flex items-center gap-3">
            {account ? (
              <Button size="sm" render={<a href="/dashboard" />}>
                Open dashboard →
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" render={<a href="/login" />}>
                  Sign in
                </Button>
                <Button size="sm" render={<a href="/login" />}>
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Adaptive deployment safety
          </div>
          <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Static error-rate thresholds are either too loose or too fragile.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            CARF classifies every commit — code, config, dependency, or infrastructure —
            and calibrates the rollback threshold to match. A config typo doesn&apos;t get
            treated like a risky dependency bump. Install the GitHub App, pick a mode, and
            CARF is watching your next deploy.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button render={<a href={account ? "/dashboard" : "/login"} />}>
              {account ? "Go to dashboard →" : "Install GitHub App →"}
            </Button>
            <a
              href="#install-server"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition-colors"
            >
              <Terminal className="size-3.5 text-primary" />
              <span>Install on your server</span>
            </a>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
          {PIPELINE_PHASES.map((phase) => (
            <div key={phase.title} className="bg-background px-4 py-4">
              <phase.icon className="size-4 text-muted-foreground" />
              <div className="mt-2 text-sm font-medium">{phase.title}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{phase.caption}</div>
            </div>
          ))}
        </div>

        {/* Dedicated "Install on your server" Section */}
        <div id="install-server" className="mt-14 scroll-mt-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  <Terminal className="size-3" />
                  <span>Host-Colocated PM2 Adapter (Standalone)</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  Run CARF directly on your own server.
                </h2>
                <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                  Colocate CARF&apos;s lightweight PM2 agent with your application processes. No database credentials ever touch your host — the agent authenticates with a repository-scoped token and communicates exclusively over HTTPS.
                </p>
              </div>
              <div className="shrink-0">
                <Button size="sm" variant="outline" render={<a href={account ? "/dashboard/setup" : "/login"} />}>
                  Get install token →
                </Button>
              </div>
            </div>

            <div className="relative mt-4">
              <div className="absolute top-2.5 left-2.5 z-10">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                  Not yet available
                </span>
              </div>
              <pre className="rounded-lg border border-border bg-slate-950 p-3.5 pt-8 font-mono text-xs text-slate-100 overflow-x-auto select-all opacity-80">
                curl -fsSL https://carf.indevs.in/install.sh | bash -s -- --token=&lt;install_token&gt;
              </pre>
              <p className="mt-2 text-[11px] text-muted-foreground/80">
                Planned automated installer (tracked in issue #153). Setup wizard currently configures Standalone PM2 directly.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="font-semibold text-foreground">Zero DB Credentials</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Only holds an HTTPS bearer token. Database URLs and secrets never touch the agent.</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="font-semibold text-foreground">7 Preflight Host Checks</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Validates PM2 daemon, process table, HTTP probe, permissions, and rollback strategy.</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="font-semibold text-foreground">Automatic Daemon Life</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Managed under PM2 as <code className="font-mono">carf-agent</code> with automatic restart and heartbeat streaming.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Simulator & Repo Checker Grid */}
        <div className="mt-14 space-y-12">
          {/* Simulator */}
          <div>
            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <Cpu className="size-3.5 text-primary" />
                <span>Interactive Pipeline Simulator</span>
              </div>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                Watch CARF classify commits and calculate canary thresholds
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Slide simulated error rates and swap commit profiles to see real-time dynamic tolerances in action.
              </p>
            </div>
            <InteractiveSimulator />
          </div>

          {/* Compatibility Checker */}
          <div className="border-t border-border pt-12">
            <CompatChecker />
          </div>
        </div>

        {/* Steps */}
        <div className="mt-14 border-t border-border pt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            How it works
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-sm border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-medium">
                    {i + 1}
                  </span>
                  <span>Step {i + 1}</span>
                </div>
                <h3 className="mt-3 text-sm font-medium text-foreground">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Onboarding guarantee */}
        <div className="mt-12 rounded-sm border border-border bg-muted/20 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-4 text-emerald-500 shrink-0" />
            <div className="text-xs leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">No production disruption:</strong>{" "}
              CARF operates in passive observation mode by default. It records AST-calibrated
              thresholds and telemetry without touching your traffic until you explicitly verify
              and enable automated rollback in your repository configuration.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
