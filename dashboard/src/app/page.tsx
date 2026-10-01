import { getCurrentAccount } from "../lib/auth";
import { Button } from "../components/ui/button";
import {
  GitBranch,
  Activity,
  Cpu,
  RotateCcw,
  CheckCircle2,
  Terminal,
  ShieldCheck,
  Server,
  Zap,
} from "lucide-react";

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
    title: "Choose standalone or augment",
    desc: "Standalone mode (live with PM2 and systemd) has CARF monitor health and execute rollbacks. Augment mode is live as a read-only recommendation: GET /v1/augment/threshold returns the calibrated error-rate ceiling and observation window for an external controller.",
  },
  {
    title: "Set classification & threshold rules",
    desc: "Tune which paths count as code / config / dependency / infra / data, and how sensitive + how long CARF watches each. Commits straight to your repo's .carf.yml.",
  },
  {
    title: "Install the host agent or query the API",
    desc: "Standalone host agent installs a background daemon with a scoped token. Augment consumers call GET /v1/augment/threshold from CI, Argo, or a deploy hook.",
  },
  {
    title: "Watch live status",
    desc: "See classified commits, computed thresholds, and rollout outcomes as they happen.",
  },
];

const PIPELINE_PHASES = [
  { icon: GitBranch, title: "Classify", caption: "Tier 1 path + Tier 2 AST" },
  { icon: Activity, title: "Calibrate", caption: "Dynamic error ceiling" },
  { icon: Cpu, title: "Observe", caption: "Host & canary soak" },
  { icon: RotateCcw, title: "Rollback", caption: "Releases symlink or git" },
];

const COMPARISON_ROWS = [
  {
    feature: "Classification granularity",
    traditional: "Binary (code vs non-code) or none",
    carf: "5 change categories across path patterns and tree-sitter AST",
  },
  {
    feature: "Error threshold",
    traditional: "Static percentage (e.g. 5% across all releases)",
    carf: "Dynamically calibrated per commit type (1% infra to 8% code)",
  },
  {
    feature: "Observation soak window",
    traditional: "Fixed timer (e.g. 15 minutes)",
    carf: "Diff-calibrated soak duration (1m docs to 20m infra)",
  },
  {
    feature: "Deployment targets",
    traditional: "Tied to single vendor ecosystem",
    carf: "Standalone PM2 / systemd host daemon & live augment API for Argo / CI",
  },
  {
    feature: "Decision transparency",
    traditional: "Opaque binary triggers",
    carf: "Inspectable audit log, diff explanations, and .carf.yml rules",
  },
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
          <div className="flex items-center gap-2 sm:gap-3">
            {account ? (
              <>
                <Button size="sm" variant="ghost" render={<a href="/dashboard" />}>
                  Dashboard
                </Button>
                <Button size="sm" render={<a href="/dashboard/setup" />}>
                  Setup Agent
                </Button>
              </>
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

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Standalone PM2 host agent and augment threshold API are live</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Stop rolling back innocent deployments.
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Static error thresholds cause false-positive rollbacks. A docs change should not have the same error tolerance as an architectural refactor. CARF inspects your diffs to dynamically calibrate observation windows and error-rate thresholds before every release.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {account ? (
              <Button size="lg" render={<a href="/dashboard/setup" />}>
                Install Host Agent &rarr;
              </Button>
            ) : (
              <Button size="lg" render={<a href="/login" />}>
                Get started free &rarr;
              </Button>
            )}
            <Button size="lg" variant="outline" render={<a href="#install-server" />}>
              1-Line Server Install
            </Button>
          </div>
        </div>

        {/* 4 Pipeline phases */}
        <div className="mt-14 border-t border-border pt-12">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {PIPELINE_PHASES.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-sm border border-border bg-card p-4">
                  <Icon className="size-5 text-foreground" />
                  <div className="mt-3 text-sm font-medium text-foreground">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.caption}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison table */}
        <div className="mt-14 border-t border-border pt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Why dynamic thresholds
          </h2>
          <div className="mt-4 overflow-x-auto rounded-sm border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30 font-medium text-muted-foreground">
                <tr>
                  <th className="p-3">Capability</th>
                  <th className="p-3">Static Canary Thresholds</th>
                  <th className="p-3">CARF Dynamic Framework</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARISON_ROWS.map((r) => (
                  <tr key={r.feature} className="hover:bg-muted/10">
                    <td className="p-3 font-medium text-foreground">{r.feature}</td>
                    <td className="p-3 text-muted-foreground">{r.traditional}</td>
                    <td className="p-3 text-foreground">{r.carf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 1-Line Server Install Section */}
        <div id="install-server" className="mt-14 scroll-mt-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  <Terminal className="size-3" />
                  <span>Host-Colocated Agent (PM2 &amp; systemd)</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  Run CARF directly on your own server.
                </h2>
                <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                  Colocate CARF&apos;s lightweight agent with your application processes. No database credentials ever touch your host — the agent authenticates with a scoped install token and communicates exclusively over HTTPS. Staged self-update checks syntax before swapping the running file.
                </p>
              </div>
              <div className="shrink-0">
                <Button size="sm" variant="outline" render={<a href={account ? "/dashboard/setup" : "/login"} />}>
                  Get install token &rarr;
                </Button>
              </div>
            </div>

            <div className="relative mt-4">
              <pre className="rounded-lg border border-border bg-slate-950 p-3.5 font-mono text-xs text-slate-100 overflow-x-auto select-all">
                curl -fsSL https://carf.indevs.in/install.sh | bash -s -- --token=&lt;install_token&gt;
              </pre>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>Runs automatically in the background via PM2 or systemd service manager.</span>
                <a href={account ? "/dashboard/setup" : "/login"} className="font-medium text-foreground underline underline-offset-2">
                  Generate token in dashboard &rarr;
                </a>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  <span>Zero DB Credentials</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Only holds an HTTPS bearer token. Database URLs and secrets never touch the agent.</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Server className="size-3.5 text-indigo-500" />
                  <span>PM2 &amp; systemd Daemon</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Automatically manages <code className="font-mono text-[10px]">carf-agent</code> process or systemd unit with automatic restart and staged self-update.</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Zap className="size-3.5 text-blue-500" />
                  <span>Preflight Health Checks</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Validates daemon reachability, process entries, HTTP probe, and layout rollback permissions.</div>
              </div>
            </div>
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
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/40 py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-mono">CARF — Change-Aware Rollback Framework</div>
          <div className="flex items-center gap-4">
            <a href="/login" className="hover:text-foreground">
              Sign in
            </a>
            <a href="/login" className="hover:text-foreground">
              Get started
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
