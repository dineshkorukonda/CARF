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
  Globe,
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
    title: "Choose standalone or augment",
    desc: "Standalone mode (live with PM2) has CARF monitor health and execute rollbacks. Augment mode is live as a read-only recommendation: GET /v1/augment/threshold returns the calibrated error-rate ceiling and observation window for an external controller.",
  },
  {
    title: "Set classification & threshold rules",
    desc: "Tune which paths count as code / config / dependency / infra / data, and how sensitive + how long CARF watches each. Commits straight to your repo's .carf.yml.",
  },
  {
    title: "Install the host agent or query the API",
    desc: "Standalone PM2 installs a host-colocated agent with a repo-scoped token. Augment consumers call GET /v1/augment/threshold from CI, Argo, or a deploy hook. First-party Kubernetes / Render adapters are still planned.",
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
  { icon: RotateCcw, title: "Roll back", caption: "PM2 reload, or advise" },
];

const PILLARS = [
  {
    icon: GitBranch,
    title: "Tier 1 path rules",
    body: "Deterministic classification of infrastructure manifests, config, lockfiles, migrations, and application code. Custom .carf.yml rules run first.",
    footnote: "infra · data · dependency · config · code",
  },
  {
    icon: Cpu,
    title: "Tier 2 Tree-sitter AST",
    body: "Structural syntax diffs measure cyclomatic change and function-level impact so a one-line typo is not scored like a control-flow rewrite.",
    footnote: "Complexity-aware calibration",
  },
  {
    icon: ShieldCheck,
    title: "Change-keyed rollback",
    body: "Each change type has its own error-rate ceiling and soak window. Across mixed commits, CARF takes the strictest threshold and the longest window.",
    footnote: "min(threshold) · max(window)",
  },
];

const MODES = [
  {
    badge: "Live",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: Terminal,
    title: "Standalone · PM2",
    body: "CARF watches process health on the host and reloads the previous release when the soak threshold is breached. The agent holds only an HTTPS token — never database credentials.",
    meta: "curl install.sh · carf-agent under PM2",
  },
  {
    badge: "Live API",
    badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    icon: Globe,
    title: "Augment · threshold API",
    body: "External CI, Argo Rollouts, or deploy hooks query GET /v1/augment/threshold for the per-commit ceiling and observation window. CARF does not execute that rollback.",
    meta: "GET /v1/augment/threshold",
  },
  {
    badge: "Planned adapters",
    badgeClass: "bg-muted text-muted-foreground border-border",
    icon: Server,
    title: "Kubernetes · Render · Compose",
    body: "No standalone adapters yet for Kubernetes, Docker Compose, or Render. Those stacks should use the live augment endpoint until a first-party driver ships.",
    meta: "Use augment mode today",
  },
];

const DEFAULT_THRESHOLDS = [
  { type: "Infrastructure", threshold: "1%", window: "60s" },
  { type: "Data", threshold: "1%", window: "10 min" },
  { type: "Dependency", threshold: "3%", window: "3 min" },
  { type: "Config", threshold: "5%", window: "5 min" },
  { type: "Code", threshold: "8%", window: "15 min" },
];

export default async function HomePage() {
  const account = await getCurrentAccount();

  return (
    <main className="min-h-screen bg-background">
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
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            PM2 standalone and augment threshold API are live
          </div>
          <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Static error-rate thresholds are either too loose or too fragile.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            CARF classifies every commit — infrastructure, data, dependency, config, or
            code — then calibrates the rollback ceiling and soak window to that change.
            A config typo is not treated like a risky dependency bump. Install the GitHub
            App, pick a mode, and CARF is watching the next deploy.
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

        <div className="mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            How CARF decides
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs">
                <div>
                  <div className="flex size-8 items-center justify-center rounded-md border border-border bg-background">
                    <pillar.icon className="size-4 text-foreground" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{pillar.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{pillar.body}</p>
                </div>
                <div className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
                  {pillar.footnote}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Two modes, one classifier
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {MODES.map((mode) => (
              <div key={mode.title} className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <mode.icon className="size-4 text-foreground" />
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${mode.badgeClass}`}>
                      {mode.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{mode.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{mode.body}</p>
                </div>
                <div className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
                  {mode.meta}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Default v1 ceilings
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Production defaults from the engine config. Mixed commits use the strictest
              threshold and the longest observation window.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Change type</th>
                  <th className="px-4 py-2.5 font-medium">Error-rate threshold</th>
                  <th className="px-4 py-2.5 font-medium">Soak window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {DEFAULT_THRESHOLDS.map((row) => (
                  <tr key={row.type}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.type}</td>
                    <td className="px-4 py-2.5 font-mono text-foreground">{row.threshold}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{row.window}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
                  Colocate CARF&apos;s lightweight PM2 agent with your application processes. No database credentials ever touch your host — the agent authenticates with a repository-scoped token and communicates exclusively over HTTPS. Staged self-update checks syntax before swapping the running file.
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
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                  Available
                </span>
              </div>
              <pre className="rounded-lg border border-border bg-slate-950 p-3.5 pt-8 font-mono text-xs text-slate-100 overflow-x-auto select-all opacity-80">
                curl -fsSL https://carf.indevs.in/install.sh | bash -s -- --token=&lt;install_token&gt;
              </pre>
              <p className="mt-2 text-[11px] text-muted-foreground/80">
                Requires Node.js and PM2 on the host. The script writes only an install token and the central API URL.
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
                <div className="mt-1 text-[11px] text-muted-foreground">Managed under PM2 as <code className="font-mono">carf-agent</code> with automatic restart, heartbeat, and staged self-update.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 space-y-12">
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
                Slide simulated error rates and swap commit profiles against the same v1 ceilings the engine uses.
              </p>
            </div>
            <InteractiveSimulator />
          </div>

          <div className="border-t border-border pt-12">
            <CompatChecker />
          </div>
        </div>

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

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>CARF — Change-Aware Rollback Framework</span>
          <span className="font-mono">Hosted at carf.indevs.in</span>
        </div>
      </footer>
    </main>
  );
}
