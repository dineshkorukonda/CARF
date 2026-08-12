import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Shield, GitBranch, Terminal } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-zinc-50 flex flex-col font-sans selection:bg-zinc-800">
      <nav className="border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="font-medium text-sm tracking-tight text-white flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            CARF
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <Link href="#features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="#integrations" className="hover:text-zinc-100 transition-colors">Integrations</Link>
            <Link href="https://github.com/dineshkorukonda/CARF" target="_blank" className="hover:text-zinc-100 transition-colors">GitHub</Link>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-32 px-6 max-w-4xl mx-auto text-center space-y-8">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 font-mono text-xs rounded-full px-3 py-1 bg-emerald-500/10">
            Pre-Implementation Phase
          </Badge>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter text-zinc-100 leading-tight">
            Rollbacks with context.
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed font-light">
            CARF is an intelligent sidecar for Argo Rollouts and Flagger. 
            It classifies every deployment by change type—code, config, dependency, or infrastructure—and 
            provides dynamic error thresholds tailored to the exact risk profile.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button className="bg-zinc-100 text-black hover:bg-zinc-200 rounded-full px-8 font-medium">
              Read the Paper
            </Button>
            <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white rounded-full px-8 font-medium">
              View on GitHub
            </Button>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="features" className="py-24 px-6 border-t border-zinc-900 bg-zinc-950/30">
          <div className="max-w-6xl mx-auto space-y-16">
            <div className="space-y-4 text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-semibold tracking-tight">One sidecar. Four steps.</h2>
              <p className="text-zinc-400">
                A seamless webhook provider that adds change-awareness to your existing delivery pipeline.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: GitBranch, title: "Classify", desc: "Analyzes Git diffs and file ASTs to tag deployments accurately." },
                { icon: Activity, title: "Persist", desc: "Saves computed change vectors to Postgres for fast retrieval." },
                { icon: Shield, title: "Evaluate", desc: "Calculates dynamic error thresholds based on the exact change type." },
                { icon: Terminal, title: "Delegate", desc: "Returns strict parameters to Argo or Flagger to execute the rollback." }
              ].map((feature, i) => (
                <Card key={i} className="bg-black border-zinc-900 overflow-hidden group hover:border-emerald-500/50 transition-colors">
                  <CardHeader>
                    <feature.icon className="h-5 w-5 text-emerald-500 mb-4 group-hover:text-emerald-400 transition-colors" />
                    <CardTitle className="text-lg font-medium text-zinc-100">{feature.title}</CardTitle>
                    <CardDescription className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Integration Section */}
        <section id="integrations" className="py-32 px-6 border-t border-zinc-900">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
                Native progressive delivery integrations.
              </h2>
              <p className="text-zinc-400 leading-relaxed text-lg font-light">
                CARF does not reinvent the wheel. It acts as a webhook provider for the mature, 
                production-grade tools you already trust. Simply point your AnalysisTemplate or 
                Webhook Metric to the CARF sidecar, and it handles the rest.
              </p>
              <ul className="space-y-4 text-zinc-300">
                <li className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Argo Rollouts (AnalysisTemplate)
                </li>
                <li className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Flagger (Webhook Metric)
                </li>
                <li className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Prometheus & Datadog Telemetry
                </li>
              </ul>
            </div>
            
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 font-mono text-sm text-zinc-300 leading-relaxed overflow-x-auto shadow-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent opacity-50" />
              <div className="text-zinc-600 mb-4"># Argo Rollouts AnalysisTemplate</div>
              <span className="text-zinc-400">apiVersion</span>: argoproj.io/v1alpha1<br/>
              <span className="text-zinc-400">kind</span>: AnalysisTemplate<br/>
              <span className="text-zinc-400">metadata</span>:<br/>
              &nbsp;&nbsp;<span className="text-zinc-400">name</span>: carf-dynamic-threshold<br/>
              <span className="text-zinc-400">spec</span>:<br/>
              &nbsp;&nbsp;<span className="text-zinc-400">metrics</span>:<br/>
              &nbsp;&nbsp;- <span className="text-zinc-400">name</span>: carf-decision<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-zinc-400">provider</span>:<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-zinc-400">web</span>:<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-zinc-400">url</span>: http://carf.carf-system.svc.cluster.local/analyze<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-zinc-400">method</span>: POST
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 px-6 border-t border-zinc-900 bg-zinc-950/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 text-sm">
          <div>© {new Date().getFullYear()} CARF Project. Built for resilience.</div>
          <div className="flex gap-6">
            <Link href="https://github.com/dineshkorukonda/CARF" className="hover:text-zinc-200 transition-colors">GitHub</Link>
            <Link href="#" className="hover:text-zinc-200 transition-colors">Documentation</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
