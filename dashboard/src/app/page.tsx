import Link from "next/link";
import Image from "next/image";
import { GitBranch, Activity, Cpu, RotateCcw, Terminal } from "lucide-react";
import { getCurrentAccount } from "../lib/auth";
import { Button } from "../components/ui/button";
import { CompatChecker } from "./CompatChecker";
import { InteractiveSimulator } from "./InteractiveSimulator";

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
    desc: "Augment mode keeps your own deployment probe and supplies the dynamic threshold. Standalone mode has CARF drive rollback itself via PM2.",
  },
  {
    title: "Set classification & threshold rules",
    desc: "Tune which paths count as code / config / dependency / infra, and how sensitive + how long CARF watches each. Commits straight to your repo's .carf.yml.",
  },
  {
    title: "Wire your pipeline (Augment only)",
    desc: "Point your deployment script or a GitHub Actions workflow at GET /v1/threshold — see the examples/ configs or the carf-threshold Action. Standalone mode needs nothing else.",
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
    <main className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <Image
              src="/icon.png"
              alt="CARF"
              width={22}
              height={22}
              className="rounded-sm shrink-0"
              priority
            />
            <span>CARF</span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="#install-server"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Terminal className="size-3.5 text-primary" />
              <span>Install on your server</span>
            </a>
            {account ? (
              <Button size="sm" render={<a href="/dashboard" />}>
                Go to dashboard →
              </Button>
            ) : (
              <Button size="sm" render={<a href="/login" />}>
                Sign in with GitHub →
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Change-Aware Rollback Framework
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Roll back only when a deployment actually needs it.
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
                  <span>Host-Colocated PM2 Adapter</span>
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

            <div className="mt-4">
              <pre className="rounded-lg border border-border bg-slate-950 p-3.5 font-mono text-xs text-slate-100 overflow-x-auto select-all">
                curl -fsSL https://carf.indevs.in/install.sh | bash -s -- --token=&lt;install_token&gt;
              </pre>
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

        <div className="mt-14">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Interactive Pipeline Simulator
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                See CARF in action.
              </h2>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Watch the video-style walkthrough step through commit classification, dynamic threshold
            decay, and automated rollback — or take the controls in manual sandbox mode.
          </p>

          <div className="mt-6">
            <InteractiveSimulator />
          </div>
        </div>

        <div className="mt-14">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            How to integrate CARF into your project
          </p>
          <div className="mt-4 space-y-2">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-3 rounded-sm border border-border bg-card px-3.5 py-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-mono text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Using your own CI/CD pipeline?{" "}
            <a
              href="https://github.com/dineshkorukonda/CARF/tree/main/examples"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4"
            >
              See the example configs and the GitHub Action
            </a>
            , or pick PM2 Standalone mode and skip pipeline wiring entirely.
          </p>
        </div>

        <div className="mt-14">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Check first</p>
          <div className="mt-4">
            <CompatChecker />
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start gap-3 rounded-sm border border-border bg-card px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Ready to connect a repo?</p>
            <p className="text-xs text-muted-foreground">Sign in with GitHub — it takes under a minute.</p>
          </div>
          <Button render={<a href={account ? "/dashboard" : "/login"} />}>
            {account ? "Go to dashboard →" : "Sign in with GitHub →"}
          </Button>
        </div>
      </div>
    </main>
  );
}
