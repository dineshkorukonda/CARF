import Link from "next/link";
import { getCurrentAccount } from "../lib/auth";
import { Button } from "../components/ui/button";
import { InstallCommandBox } from "../components/InstallCommandBox";
import {
  GitBranch,
  Activity,
  Cpu,
  RotateCcw,
  ShieldCheck,
  Server,
  Zap,
  ExternalLink,
  Layers,
  CheckCircle2,
  Sliders,
  ArrowRight,
  Code2,
  Box,
  Radio,
} from "lucide-react";

const STEPS = [
  {
    title: "Connect your repository",
    desc: "Grant CARF read access to classify commits on your target repositories — choose all or a curated subset.",
  },
  {
    title: "Define rules in .carf.yml",
    desc: "Configure target runtime (Kubernetes, Docker, systemd, or PM2) and tune custom sensitivity rules per path or AST node type.",
  },
  {
    title: "Automated AST Classification",
    desc: "Every commit is parsed by Tree-sitter AST, categorizing changes into code, config, dependency, infrastructure, or data.",
  },
  {
    title: "Calibrate dynamic error ceilings",
    desc: "CARF computes adaptive error thresholds and soak durations: high-risk infra gets tight 1% ceilings, while docs pass instantly.",
  },
  {
    title: "Deploy with host agent or API",
    desc: "Run the lightweight host daemon for standalone management, or query the augment API from Argo Rollouts, Flagger, or CI runners.",
  },
  {
    title: "Continuous soak & instant rollback",
    desc: "Telemetry is monitored during soak. If error thresholds breach, CARF immediately triggers an atomic rollback to the previous healthy revision.",
  },
];

const PIPELINE_PHASES = [
  { icon: GitBranch, title: "1. Classify", caption: "Tree-sitter AST & churn vector" },
  { icon: Activity, title: "2. Calibrate", caption: "Dynamic error-rate ceiling" },
  { icon: Cpu, title: "3. Observe", caption: "Prometheus & HTTP soak probes" },
  { icon: RotateCcw, title: "4. Recover", caption: "Sub-second atomic rollback" },
];

const COMPARISON_ROWS = [
  {
    feature: "Classification granularity",
    traditional: "Binary (code vs non-code) or none",
    carf: "5 change categories across path patterns and Tree-sitter AST syntax",
  },
  {
    feature: "Error threshold",
    traditional: "Static percentage (e.g. 5% across all releases)",
    carf: "Dynamically calibrated per commit type (1% infra to 8% docs)",
  },
  {
    feature: "Observation soak window",
    traditional: "Fixed timer (e.g. 15 minutes)",
    carf: "Diff-calibrated soak duration (1m docs to 20m infra)",
  },
  {
    feature: "Supported runtimes",
    traditional: "Single platform lock-in (K8s only or vendor VM)",
    carf: "Kubernetes, Docker Compose, Linux systemd, PM2, Argo, Flagger",
  },
  {
    feature: "Rollback execution",
    traditional: "Manual intervention or slow pod teardown",
    carf: "Sub-second atomic rollback via symlink swap, rollout undo, or systemctl",
  },
  {
    feature: "Decision transparency",
    traditional: "Opaque pass/fail exit code",
    carf: "Inspectable audit log, diff explanations, and .carf.yml rules",
  },
];

const RUNTIMES = [
  {
    name: "Kubernetes",
    tag: "Native kubectl",
    desc: "Deployment rollbacks via kubectl rollout undo with pod readiness validation.",
    icon: Box,
  },
  {
    name: "Docker Compose",
    tag: "Container Runtime",
    desc: "Container health inspection, restart counter tracking, and image tag rollbacks.",
    icon: Layers,
  },
  {
    name: "Linux systemd",
    tag: "Linux Services",
    desc: "Systemctl service lifecycle management, journald error monitoring, and git restore.",
    icon: Server,
  },
  {
    name: "PM2 Process Manager",
    tag: "Host Daemon",
    desc: "Zero-downtime cluster reloads, memory leak monitoring, and automated restore.",
    icon: Server,
  },
  {
    name: "Argo Rollouts",
    tag: "Progressive Delivery",
    desc: "Kubernetes CRD canary analysis and blue/green automated rollbacks via AnalysisTemplate.",
    icon: Activity,
  },
  {
    name: "Flagger Canary",
    tag: "Service Mesh / Ingress",
    desc: "Automated traffic shifting and canary promotion or rollback using Flagger webhooks.",
    icon: Zap,
  },
  {
    name: "Prometheus PromQL",
    tag: "Telemetry Source",
    desc: "Authoritative health evaluation querying Prometheus/VictoriaMetrics instant query API.",
    icon: Radio,
  },
  {
    name: "Universal Webhook API",
    tag: "Any CI / Pipeline",
    desc: "Standard REST endpoints for GitLab CI, Jenkins, GitHub, or custom bash scripts.",
    icon: Code2,
  },
];

export default async function HomePage() {
  const account = await getCurrentAccount();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground">
              <span className="font-mono text-base font-bold tracking-tighter bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                CARF
              </span>
              <span className="hidden md:inline text-xs text-muted-foreground font-medium">
                Change-Aware Rollback Framework
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
              <a href="#features" className="transition-colors hover:text-foreground">
                Features
              </a>
              <a href="#install-server" className="transition-colors hover:text-foreground">
                Host Setup
              </a>
              <a href="#how-it-works" className="transition-colors hover:text-foreground">
                How It Works
              </a>
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
                  Setup Target
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
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
          {/* Subtle Ambient Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[600px] h-[350px] bg-primary/10 blur-[130px] rounded-full pointer-events-none" />

          <div className="mx-auto max-w-5xl px-6 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground leading-[1.12]">
              Deployments that know
              <span className="block text-primary mt-1.5">when to roll themselves back.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg leading-relaxed">
              CARF classifies syntactic changes across every commit using Tree-sitter AST, dynamically calibrating error ceilings and soak observation windows. If a release degrades, CARF executes sub-second atomic rollbacks across Kubernetes, Docker, systemd, and PM2 before your users notice.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Button size="lg" render={<Link href={account ? "/dashboard" : "/login"} />}>
                <span>{account ? "Go to Dashboard" : "Get Started Free"}</span>
                <ArrowRight className="size-4 ml-1.5" />
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/dashboard/integrations" />}>
                <Layers className="size-4 mr-1.5 text-primary" />
                <span>Explore Integrations Center</span>
              </Button>
            </div>

            {/* Pipeline Phase Strip */}
            <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 text-left">
              {PIPELINE_PHASES.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.title}
                    className="flex flex-col rounded-xl border border-border bg-card/60 p-4 transition-all hover:border-primary/40 hover:bg-card shadow-2xs"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="mt-2.5 text-xs font-semibold text-foreground">{p.title}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{p.caption}</div>
                  </div>
                );
              })}
            </div>

            {/* Live Interactive Engine Preview Visual */}
            <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-lg text-left">
              {/* Window Bar */}
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-500/80" />
                    <span className="size-2.5 rounded-full bg-amber-500/80" />
                    <span className="size-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground pl-2 font-medium">
                    carf-engine v1.4.0 — automated release monitor
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Automated Guard Active
                  </span>
                </div>
              </div>

              {/* Panel Grid */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                {/* 1. Commit Analysis */}
                <div className="p-3.5 rounded-lg border border-border bg-background flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>1. AST Analysis</span>
                      <GitBranch className="size-3 text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-medium">commit: b7a89f3</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">feat(billing): update invoice retry</p>
                    <div className="mt-3 space-y-1 text-[11px]">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Classification:</span>
                        <span className="font-semibold text-emerald-500">CODE / LOGIC</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>AST Churn:</span>
                        <span className="text-foreground">+42 nodes</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Risk Tier:</span>
                        <span className="text-foreground font-semibold">MODERATE</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Calibrated Policy */}
                <div className="p-3.5 rounded-lg border border-border bg-background flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>2. Dynamic Policy</span>
                      <Sliders className="size-3 text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-medium">Adaptive Calibration</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Computed from commit blast radius</p>
                    <div className="mt-3 space-y-1 text-[11px]">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Error Ceiling:</span>
                        <span className="font-bold text-amber-500">0.024 (2.4%)</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Soak Window:</span>
                        <span className="text-foreground font-semibold">180 seconds</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Grace Period:</span>
                        <span className="text-foreground">30 seconds</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Live Observation */}
                <div className="p-3.5 rounded-lg border border-border bg-background flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>3. Observability</span>
                      <Activity className="size-3 text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-medium">Prometheus & Probes</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Live soak telemetry stream</p>
                    <div className="mt-3 space-y-1 text-[11px]">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Observed Error:</span>
                        <span className="font-bold text-emerald-500">0.001% &lt; 2.4%</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Health Probes:</span>
                        <span className="text-emerald-500 font-semibold">100% Passing</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Rollback Guard:</span>
                        <span className="text-foreground">Ready (Sub-second)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Capabilities Section */}
        <section id="features" className="border-t border-border py-20 bg-muted/20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Engineered for Modern Reliability
              </h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Everything you need to eliminate deployment downtime
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Traditional canaries rely on blind timers and fixed percentage thresholds. CARF introduces syntactic awareness and dynamic error calibration.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <Code2 className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Tree-Sitter AST Diff Engine</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Understands code syntax across TypeScript, Python, Go, Rust, Java, and schemas. Classifies diffs into code, config, dependency, infrastructure, or docs.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Syntactic churn & blast-radius scoring</span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="size-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                    <Sliders className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Dynamic Threshold Calibration</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Replaces brittle static 5% error gates. Calculates error ceilings and soak duration dynamically: high-risk infra gets tight 1% ceilings; docs pass instantly.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Configured via simple .carf.yml rules</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                    <RotateCcw className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Multi-Runtime Rollbacks</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    First-class recovery adapters for Kubernetes deployments (kubectl undo), Docker Compose, Linux systemd units, and PM2 clusters.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Sub-second atomic rollback execution</span>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="size-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4">
                    <Zap className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Progressive Canary Hooks</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Native integration with Argo Rollouts AnalysisTemplates and Flagger Canary webhooks to drive traffic shifting and automated aborts.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Kubernetes native CRD compatibility</span>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="size-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
                    <Radio className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Authoritative PromQL Telemetry</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Queries Prometheus or VictoriaMetrics instant query API directly to evaluate real production error rates and latency SLOs against dynamic ceilings.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Instant PromQL metric evaluation</span>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="size-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                    <ShieldCheck className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Zero-Trust Host Security</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Host agents require zero database credentials and communicate exclusively over TLS with scoped bearer tokens. Includes preflight syntax validation.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span>Zero sensitive keys on managed hosts</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Universal Integrations Grid */}
        <section className="border-t border-border py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-10">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Universal Runtime Support
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mt-1">
                  Works with your existing stack
                </h2>
                <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                  Whether you run cloud-native Kubernetes clusters, containerized Docker stacks, or bare-metal Linux services, CARF integrates seamlessly.
                </p>
              </div>

              <Button render={<Link href="/dashboard/integrations" />}>
                <span>Visit Integrations Center</span>
                <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {RUNTIMES.map((r) => {
                const Icon = r.icon;
                return (
                  <Link
                    key={r.name}
                    href="/dashboard/integrations"
                    className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <Icon className="size-4" />
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {r.tag}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {r.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {r.desc}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-[11px] font-medium text-primary">
                      <span>View guide & manifest</span>
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="border-t border-border py-20 bg-muted/20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Architectural Breakdown
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mt-1">
                Why CARF vs traditional rollbacks
              </h2>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card text-left shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                      <th className="p-3.5 text-left font-medium">Dimension</th>
                      <th className="p-3.5 text-left font-medium">Traditional Canary / Spinnaker</th>
                      <th className="p-3.5 text-left font-medium text-primary">CARF Automated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {COMPARISON_ROWS.map((r) => (
                      <tr key={r.feature} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3.5 font-medium text-foreground">{r.feature}</td>
                        <td className="p-3.5 text-muted-foreground">{r.traditional}</td>
                        <td className="p-3.5 text-foreground font-medium">{r.carf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Docker & Host Install Section */}
        <section id="install-server" className="border-t border-border py-20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-medium uppercase tracking-wider text-primary">
                    <Box className="size-3.5" />
                    <span>Docker &amp; Host Daemon</span>
                  </div>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    Run CARF on any server in seconds
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xl leading-relaxed">
                    Deploy with a single Docker command or lightweight shell script. The agent manages local rollbacks over HTTPS with zero database credentials or root privileges.
                  </p>
                </div>
                <div className="shrink-0">
                  <Button size="sm" variant="outline" render={<Link href={account ? "/dashboard/setup" : "/login"} />}>
                    <span>Setup in Dashboard</span>
                    <ArrowRight className="size-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-6">
                <InstallCommandBox initialTab="docker" />
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>Isolated container execution with automatic healthcheck verification and reboot persistence.</span>
                  <Link
                    href={account ? "/dashboard/setup" : "/login"}
                    className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors"
                  >
                    Link host token in dashboard &rarr;
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-lg border border-border bg-muted/20 p-3.5">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Box className="size-3.5 text-blue-500" />
                    <span>1-Command Docker Setup</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Zero host dependencies or Node runtime required. Runs isolated via Docker CLI or Compose.
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3.5">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <ShieldCheck className="size-3.5 text-emerald-500" />
                    <span>Zero DB Credentials</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Only holds an HTTPS bearer token. Database URLs and secrets never touch the agent.
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3.5">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Server className="size-3.5 text-primary" />
                    <span>Multi-Runtime Recovery</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Supervises Docker containers, Kubernetes deployments, systemd services, or PM2 apps.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Steps */}
        <section id="how-it-works" className="border-t border-border py-20 bg-muted/20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step-by-Step Architecture
              </h2>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                How CARF protects your releases
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 text-left">
              {STEPS.map((step, i) => (
                <div key={step.title} className="rounded-xl border border-border bg-card p-5 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 font-bold text-primary">
                      {i + 1}
                    </span>
                    <span>Step 0{i + 1}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="border-t border-border py-20">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">
              <h2 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">
                Ready to stop blind rollbacks?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Connect your repositories in two minutes. Calibrated error ceilings, Tree-sitter AST classification, and automated multi-runtime recovery.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" render={<Link href={account ? "/dashboard" : "/login"} />}>
                  <span>{account ? "Go to Dashboard" : "Get Started Free"}</span>
                  <ArrowRight className="size-4 ml-1.5" />
                </Button>
                <Button size="lg" variant="outline" render={<Link href="/dashboard/integrations" />}>
                  <span>Explore All Integrations</span>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Full Width Footer */}
      <footer className="border-t border-border bg-card/40 py-12 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-tight bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                  CARF
                </span>
                <span className="text-foreground font-semibold text-sm">Change-Aware Rollback Framework</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Automated deployment resilience with AST change classification & multi-runtime recovery.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <Link href={account ? "/dashboard" : "/login"} className="transition-colors hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/dashboard/integrations" className="transition-colors hover:text-foreground">
                Integrations
              </Link>
              <Link href={account ? "/dashboard/setup" : "/login"} className="transition-colors hover:text-foreground">
                Setup Target
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
            <span>Supports Kubernetes, Docker, systemd, PM2, Argo, Flagger & Prometheus.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
