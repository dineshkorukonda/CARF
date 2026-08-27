import Link from "next/link";
import { GitBranch, Activity, Cpu, RotateCcw } from "lucide-react";
import { getCurrentAccount } from "../lib/auth";
import { Button } from "../components/ui/button";
import { ThemeToggle } from "../components/ThemeToggle";
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
    desc: "Augment mode keeps your own canary tool (Argo Rollouts, Flagger) and just supplies the threshold. Standalone mode has CARF drive rollback itself — Kubernetes, Docker Compose, Docker Swarm, PM2, or GitOps.",
  },
  {
    title: "Set classification & threshold rules",
    desc: "Tune which paths count as code / config / dependency / infra, and how sensitive + how long CARF watches each. Commits straight to your repo's .carf.yml.",
  },
  {
    title: "Wire your pipeline (Augment only)",
    desc: "Point Argo Rollouts, Flagger, or a GitHub Actions workflow at GET /v1/threshold — see the examples/ configs or the carf-threshold Action. Standalone mode needs nothing else.",
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
  { icon: RotateCcw, title: "Roll back", caption: "kubectl / compose / git revert" },
];

export default async function HomePage() {
  const account = await getCurrentAccount();

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium tracking-tight">
            <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-semibold text-background">
              CARF
            </span>
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {account ? (
              <Button size="sm" render={<a href="/dashboard" />}>
                Go to dashboard →
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" render={<a href="/login" />}>
                  Sign in
                </Button>
                <Button size="sm" render={<a href="/signup" />}>
                  Sign up
                </Button>
              </>
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
            Not using Argo Rollouts or Flagger?{" "}
            <a
              href="https://github.com/dineshkorukonda/CARF/tree/main/examples"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4"
            >
              See the example configs and the GitHub Action
            </a>
            , or pick Standalone mode and skip pipeline wiring entirely.
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
          <Button render={<a href={account ? "/dashboard" : "/signup"} />}>
            {account ? "Go to dashboard →" : "Sign up →"}
          </Button>
        </div>
      </div>
    </main>
  );
}
