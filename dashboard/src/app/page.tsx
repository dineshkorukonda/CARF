import Link from "next/link";
import { getCurrentAccount } from "../lib/auth";
import { Button } from "../components/ui/button";
import { InstallCommandBox } from "../components/InstallCommandBox";
import {
  GitBranch,
  Activity,
  Cpu,
  RotateCcw,
  Terminal,
  ShieldCheck,
  Server,
  Zap,
  ExternalLink,
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
    desc: "Standalone mode (live with PM2) has CARF monitor health and execute rollbacks. Augment mode is live as a read-only recommendation: GET /v1/augment/threshold returns the calibrated error-rate ceiling and observation window for an external controller.",
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
    carf: "Standalone PM2 host daemon & live augment API for Argo / CI",
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
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground">
              <span className="font-mono text-base font-bold">CARF</span>
              <span className="hidden md:inline text-xs text-muted-foreground font-normal">
                / Change-Aware Rollback Framework
              </span>
            </Link>

            <nav className="hidden sm:flex items-center gap-4 text-xs font-medium text-muted-foreground">
              <a href="#how-it-works" className="transition-colors hover:text-foreground">
                How it works
              </a>
              <a href="#install-server" className="transition-colors hover:text-foreground">
                Host Agent
              </a>
              <Link href="/dashboard/verify" className="transition-colors hover:text-foreground">
                Threshold Demo
              </Link>
              <a
                href="https://github.com/dineshkorukonda/CARF"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <span>GitHub</span>
                <ExternalLink className="size-3 opacity-60" />
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {account ? (
              <>
                <Button size="sm" variant="ghost" render={<Link href="/dashboard" />}>
                  Dashboard
                </Button>
                <Button size="sm" render={<Link href="/dashboard/setup" />}>
                  Setup Agent
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" render={<Link href="/login" />}>
                  Sign in
                </Button>
                <Button size="sm" render={<Link href="/login" />}>
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Hero */}
        <div className="mx-auto max-w-5xl px-6 pt-16 pb-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-foreground">
            Deployments that know
            <span className="block text-primary mt-1">when to roll themselves back.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            CARF classifies what changed in every commit &mdash; code, config, dependencies,
            infra, or data &mdash; and calibrates its observation window and error-rate threshold
            dynamically. Infra changes get a tighter error-rate threshold and longer soak; docs changes pass instantly.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" render={<Link href={account ? "/dashboard" : "/login"} />}>
              {account ? "Go to Dashboard" : "Sign in with GitHub"} &rarr;
            </Button>
            <Button size="lg" variant="outline" render={<a href="#how-it-works" />}>
              How it works
            </Button>
          </div>

          {/* Pipeline Phase Strip */}
          <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PIPELINE_PHASES.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className="flex flex-col items-center rounded-lg border border-border/60 bg-muted/20 p-4 text-center"
                >
                  <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="mt-2 text-xs font-semibold text-foreground">{p.title}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{p.caption}</div>
                </div>
              );
            })}
          </div>

          {/* Feature Comparison */}
          <div className="mt-14 overflow-hidden rounded-xl border border-border bg-card text-left shadow-xs">
            <div className="border-b border-border bg-muted/30 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Why CARF vs traditional rollbacks
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="p-3 text-left font-medium">Dimension</th>
                    <th className="p-3 text-left font-medium">Traditional (Argo / Flagger)</th>
                    <th className="p-3 text-left font-medium text-primary">CARF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
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
          <div id="install-server" className="mt-14 scroll-mt-20 text-left">
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-medium uppercase tracking-wider text-primary">
                    <Terminal className="size-3.5" />
                    <span>Host-Colocated Agent (PM2)</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                    Run CARF directly on your own server.
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                    Colocate CARF&apos;s lightweight agent with your application processes. No database credentials ever touch your host &mdash; the agent runs locally via PM2 and communicates exclusively over HTTPS. Staged self-update checks syntax before swapping the running file.
                  </p>
                </div>
                <div className="shrink-0">
                  <Button size="sm" variant="outline" render={<Link href={account ? "/dashboard/setup" : "/login"} />}>
                    Setup in Dashboard &rarr;
                  </Button>
                </div>
              </div>

              <div className="mt-5">
                <InstallCommandBox command="curl -fsSL https://carf.indevs.in/install.sh | bash" />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>Runs automatically in the background via PM2. Link with your dashboard during setup.</span>
                  <Link href={account ? "/dashboard/setup" : "/login"} className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors">
                    Link server in dashboard &rarr;
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
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
                    <span>PM2 Daemon</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Automatically manages <code className="font-mono text-[10px]">carf-agent</code> background process with auto-restart on crashes or reboot.</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Zap className="size-3.5 text-blue-500" />
                    <span>Preflight Health Checks</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Validates PM2 process targets, HTTP probe reachability, and rollback permissions.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div id="how-it-works" className="mt-14 scroll-mt-20 border-t border-border pt-12">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              How it works
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 text-left">
              {STEPS.map((step, i) => (
                <div key={step.title} className="rounded-sm border border-border bg-card p-5">
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted font-bold text-foreground">
                      {i + 1}
                    </span>
                    <span>Step {i + 1}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer CTA */}
          <div className="mt-16 rounded-xl border border-border bg-muted/30 p-8">
            <h2 className="text-xl font-bold text-foreground">
              Ready to stop blind rollbacks?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
              Connect your repositories in two minutes. Calibrated error-rate thresholds, zero-config commit classification, and automated verification.
            </p>
            <div className="mt-6">
              <Button render={<Link href={account ? "/dashboard" : "/login"} />}>
                {account ? "Go to Dashboard" : "Sign in with GitHub"} &rarr;
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Full Width Footer */}
      <footer className="border-t border-border bg-card/40 py-10 text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-foreground">CARF</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Change-Aware Rollback Framework &bull; Dynamic error-rate thresholds &amp; PM2 daemon
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <Link href={account ? "/dashboard" : "/login"} className="transition-colors hover:text-foreground">
                Dashboard
              </Link>
              <Link href={account ? "/dashboard/setup" : "/login"} className="transition-colors hover:text-foreground">
                Setup Agent
              </Link>
              <Link href="/dashboard/verify" className="transition-colors hover:text-foreground">
                Threshold Demo
              </Link>
              <a
                href="https://github.com/dineshkorukonda/CARF"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-foreground"
              >
                GitHub
              </a>
            </div>
          </div>

          <div className="mt-8 border-t border-border/40 pt-4 text-[11px] text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; {new Date().getFullYear()} CARF. Open source rollback automation.</span>
            <span>Exclusively powered by PM2 daemon host agents.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
