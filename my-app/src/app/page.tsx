import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ProblemStatement } from "@/components/ProblemStatement";
import { HowItWorks } from "@/components/HowItWorks";
import { InteractiveSimulator } from "@/components/InteractiveSimulator";
import { IntegrationSnippet } from "@/components/IntegrationSnippet";
import { ChangeTypeMatrix } from "@/components/ChangeTypeMatrix";
import { SupportedTargets } from "@/components/SupportedTargets";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#08080a] text-zinc-100 selection:bg-cyan-500/20 selection:text-cyan-300">
      <Navbar />
      <main className="flex-grow">
        <Hero />
        <ProblemStatement />
        <HowItWorks />
        <InteractiveSimulator />
        <IntegrationSnippet />
        <ChangeTypeMatrix />
        <SupportedTargets />
      </main>
      <Footer />
    </div>
  );
}
