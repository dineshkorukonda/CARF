import Link from "next/link";
import { getCurrentAccount } from "../lib/auth";
import { Button } from "../components/ui/button";
import { InstallCommandBox } from "../components/InstallCommandBox";
import { ArrowRight } from "lucide-react";

const ENGINE_MATRIX = [
  {
    type: "infra",
    baseCeiling: "1.00%",
    soakWindow: "60s",
    sensitivity: "Critical / Immediate trip",
    description: "Kubernetes manifests, Dockerfiles, Terraform, CI/CD workflows, ingress routes.",
    adapter: "kubectl rollout undo / Docker tag revert",
  },
  {
    type: "data",
    baseCeiling: "1.50%",
    soakWindow: "600s",
    sensitivity: "High / Migration guard",
    description: "Prisma schemas, SQL migrations, seed files, database altering scripts.",
    adapter: "Service drain & migration lock hold",
  },
  {
    type: "dependency",
    baseCeiling: "2.00%",
    soakWindow: "180s",
    sensitivity: "Elevated / Supply-chain",
    description: "package-lock.json, pnpm-lock.yaml, Cargo.lock, requirements.txt, go.sum.",
    adapter: "Package rollback & cache purge",
  },
  {
    type: "config",
    baseCeiling: "2.50%",
    soakWindow: "300s",
    sensitivity: "Moderate / Flag drift",
    description: "Environment templates, JSON/YAML app configs, feature flag definitions.",
    adapter: "Config restoration & daemon reload",
  },
  {
    type: "code",
    baseCeiling: "5.00%",
    soakWindow: "900s",
    sensitivity: "Calibrated by AST complexity",
    description: "Application source files. Tree-sitter AST calculates node churn and depth to apply decay.",
    adapter: "PM2 reload / symlink swap / systemctl",
  },
];

const CAPABILITIES = [
  {
    title: "Risk Policy",
    layer: "Layer 1: CARF Core",
    description: "Tree-sitter AST syntax parsing evaluates commit modifications into 5 change vectors with structural complexity decay, calculating risk-adjusted error ceilings.",
    availability: "Available across all repositories and delivery pipelines.",
  },
  {
    title: "Runtime Monitoring",
    layer: "Telemetry & Health",
    description: "Active production observation querying Prometheus PromQL instant queries or periodic HTTP health probes (/healthz) throughout the computed soak window.",
    availability: "Enabled when a runtime target or health provider is configured.",
  },
  {
    title: "Automated Rollback",
    layer: "Layer 3: Runtime Control",
    description: "Closed-loop sub-second deployment recovery. If telemetry breaches dynamic ceilings during soak, CARF triggers atomic rollbacks before end users are impacted.",
    availability: "Supported on PM2, Docker Compose, Kubernetes, and systemd.",
  },
];

export default async function HomePage() {
  const account = await getCurrentAccount();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/20 selection:text-primary font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground">
              <span className="font-mono text-sm font-bold tracking-tight text-foreground">
                CARF
              </span>
              <span className="hidden sm:inline text-xs text-muted-foreground font-medium">
                Change-Aware Rollback Framework
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-xs text-muted-foreground font-medium">
              <a href="#architecture" className="transition-colors hover:text-foreground">
                3-Layer Architecture
              </a>
              <a href="#engine" className="transition-colors hover:text-foreground">
                Threshold Engine
              </a>
              <a href="#capabilities" className="transition-colors hover:text-foreground">
                Capabilities
              </a>
              <Link href="/docs/integrations" className="transition-colors hover:text-foreground">
                Integrations
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {account ? (
              <>
                <Button size="sm" variant="ghost" render={<Link href="/dashboard" />}>
                  Console
                </Button>
                <Button size="sm" render={<Link href="/dashboard/setup" />}>
                  Setup Target
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" render={<Link href="/login" />}>
                  Sign in
                </Button>
                <Button size="sm" render={<Link href="/login" />}>
                  Connect repo
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Asymmetric Technical Spec Hero */}
        <section className="border-b border-border py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Left Column: Technical Narrative */}
              <div className="lg:col-span-7 flex flex-col justify-center">
                <div className="font-mono text-xs font-medium text-muted-foreground mb-3">
                  Engine v1.4.0 &bull; Tree-sitter AST &amp; Multi-Vector Churn Analysis
                </div>

                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground leading-tight">
                  Dynamic rollback thresholds and soak windows derived from commit AST diffs.
                </h1>

                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  Static canary timers and arbitrary 5% error gates miss acute infrastructure failures while unnecessarily failing trivial updates.
                  CARF classifies change risk across 5 distinct vector categories with Tree-sitter AST structural complexity scoring,
                  computing per-commit error-rate thresholds, soak observation windows, and automated recovery actions.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button size="default" render={<Link href={account ? "/dashboard" : "/login"} />}>
                    <span>{account ? "Open Dashboard" : "Connect Repository"}</span>
                    <ArrowRight className="size-3.5 ml-1.5" />
                  </Button>
                  <Button size="default" variant="outline" render={<Link href="/docs/integrations" />}>
                    <span>View Architecture Spec</span>
                  </Button>
                </div>

                <div className="mt-10 pt-6 border-t border-border font-mono text-xs text-muted-foreground">
                  <div className="text-foreground font-semibold uppercase tracking-wider mb-2">
                    Engine Scope
                  </div>
                  <div>
                    5 Vector Categories &bull; Tree-sitter AST Complexity &bull; 60s–900s Adaptive Soak &bull; Sub-Second Recovery
                  </div>
                </div>
              </div>

              {/* Right Column: Code & API Policy Inspector */}
              <div className="lg:col-span-5">
                <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
                  <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2.5 font-mono text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">GET /v1/threshold?commit=b7a89f3</span>
                    <span className="text-[11px]">200 OK</span>
                  </div>

                  <pre className="p-4 font-mono text-xs text-foreground bg-muted/20 overflow-x-auto leading-relaxed">
                    <code>{`{
  "commit": "b7a89f3",
  "changeVector": {
    "infra": 0.65,
    "dependency": 0.00,
    "config": 0.20,
    "code": 0.15,
    "data": 0.00,
    "code_complexity": 0.42
  },
  "computedThreshold": {
    "errorRateCeiling": 0.010,
    "soakDurationSeconds": 60,
    "gracePeriodSeconds": 15,
    "activeTypes": ["infra", "config", "code"]
  },
  "capabilities": ["policy", "monitoring", "rollback"]
}`}</code>
                  </pre>

                  <div className="border-t border-border bg-muted/10 p-3 font-mono text-[11px] text-muted-foreground flex justify-between items-center">
                    <span>Target: k8s/ingress.yaml</span>
                    <span className="text-foreground font-medium">Ceiling: 1.00% over 60s soak</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Layer Architecture Section */}
        <section id="architecture" className="border-b border-border py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                System Nomenclature
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-1">
                The 3-layer architecture taxonomy
              </h2>
              <p className="mt-2 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                CARF separates concerns into three distinct operational layers, avoiding conflation between CI/CD delivery pipelines, host execution runtimes, and core risk policy evaluation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Layer 1 */}
              <div className="rounded-lg border border-border bg-card p-6 flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Layer 1: Core Engine
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    Policy &amp; Risk Engine
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Evaluates commits and pull requests before and after deploy. Performs Tier 1 pattern tallies and Tier 2 Tree-sitter AST structural complexity scoring to compute risk-calibrated thresholds.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border font-mono text-[11px] text-foreground">
                  <div className="text-muted-foreground mb-1">Responsibilities</div>
                  <div>AST Diff Parsing &bull; ChangeVector &bull; Threshold Decay</div>
                </div>
              </div>

              {/* Layer 2 */}
              <div className="rounded-lg border border-border bg-card p-6 flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Layer 2: Deployment
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    Delivery &amp; CI/CD Pipelines
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Connects to your delivery workflow to gate rollouts or trigger automated canary promotions. Can query CARF via REST API or run directly inside GitHub Actions.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border font-mono text-[11px] text-foreground">
                  <div className="text-muted-foreground mb-1">Integrations</div>
                  <div>GitHub Actions &bull; Argo Rollouts &bull; Generic HTTP CI</div>
                </div>
              </div>

              {/* Layer 3 */}
              <div className="rounded-lg border border-border bg-card p-6 flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Layer 3: Runtime
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    Workload Execution Platforms
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    The platform where application containers and processes actually run. Executes health inspections and performs sub-second atomic rollbacks when thresholds breach.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border font-mono text-[11px] text-foreground">
                  <div className="text-muted-foreground mb-1">Targets</div>
                  <div>PM2 &bull; Docker Compose &bull; Kubernetes &bull; systemd</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Threshold Engine Matrix */}
        <section id="engine" className="border-b border-border py-16 bg-muted/15">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Threshold Calibration Engine
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-1">
                Deterministic 5-category change vector matrix
              </h2>
              <p className="mt-2 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Every commit is categorized across five change vectors. The threshold decay formula combines vector magnitude and Tree-sitter AST complexity to dictate soak duration and error tolerance.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 font-mono text-muted-foreground">
                      <th className="p-3.5 font-medium">Change Vector</th>
                      <th className="p-3.5 font-medium">Base Ceiling</th>
                      <th className="p-3.5 font-medium">Soak Window</th>
                      <th className="p-3.5 font-medium">Sensitivity Tier</th>
                      <th className="p-3.5 font-medium">Scope &amp; Examples</th>
                      <th className="p-3.5 font-medium text-foreground">Recovery Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ENGINE_MATRIX.map((row) => (
                      <tr key={row.type} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-foreground">{row.type}</td>
                        <td className="p-3.5 font-mono font-medium text-foreground">{row.baseCeiling}</td>
                        <td className="p-3.5 font-mono text-muted-foreground">{row.soakWindow}</td>
                        <td className="p-3.5 text-muted-foreground">{row.sensitivity}</td>
                        <td className="p-3.5 text-muted-foreground max-w-xs">{row.description}</td>
                        <td className="p-3.5 font-mono text-foreground font-medium">{row.adapter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Standard Capabilities Matrix */}
        <section id="capabilities" className="border-b border-border py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Standard Capabilities
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-1">
                Unlocked deployment capabilities
              </h2>
              <p className="mt-2 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Configured per repository based on connected delivery channels, health providers, and runtime platforms.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {CAPABILITIES.map((cap) => (
                <div key={cap.title} className="rounded-lg border border-border bg-card p-6 flex flex-col justify-between">
                  <div>
                    <div className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {cap.layer}
                    </div>
                    <h3 className="text-base font-semibold text-foreground">
                      {cap.title}
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                      {cap.description}
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-border font-mono text-[11px] text-foreground">
                    <div className="text-muted-foreground mb-1">Availability</div>
                    <div>{cap.availability}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Host Installation Section */}
        <section id="installation" className="py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                  Host Agent Deployment
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl mt-1">
                  Deploy the CARF agent daemon
                </h2>
                <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                  Run directly on application hosts via Docker CLI, Docker Compose, or standalone shell daemon.
                  Communicates over HTTPS with zero database credentials or root privileges.
                </p>
              </div>

              <Button variant="outline" size="sm" render={<Link href={account ? "/dashboard/setup" : "/login"} />}>
                <span>Configure in Dashboard</span>
                <ArrowRight className="size-3.5 ml-1.5" />
              </Button>
            </div>

            <InstallCommandBox initialTab="docker" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-8 text-xs text-muted-foreground font-mono">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-foreground">CARF &bull; Change-Aware Rollback Framework</span>
            <span className="text-[11px] text-muted-foreground">3-Layer Architecture &bull; 5-Vector AST Engine &bull; Sub-Second Rollback Recovery.</span>
          </div>

          <div className="flex items-center gap-5 text-[11px]">
            <a href="https://github.com/dineshkorukonda/CARF" target="_blank" rel="noreferrer" className="hover:text-foreground">
              GitHub
            </a>
            <Link href="/docs/integrations" className="hover:text-foreground">
              Integrations
            </Link>
            <Link href="/dashboard" className="hover:text-foreground">
              Console
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
