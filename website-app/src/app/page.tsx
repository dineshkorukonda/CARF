import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ProblemStatement } from "@/components/ProblemStatement";
import { HowItWorks } from "@/components/HowItWorks";
import { FeatureSections } from "@/components/FeatureSections";
import { InteractiveSimulator } from "@/components/InteractiveSimulator";
import { IntegrationSnippet } from "@/components/IntegrationSnippet";
import { ChangeTypeMatrix } from "@/components/ChangeTypeMatrix";
import { SupportedTargets } from "@/components/SupportedTargets";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <Navbar />
      <main className="flex-grow">
        <Hero />
        <ProblemStatement />
        <HowItWorks />
        <FeatureSections />
        <InteractiveSimulator />
        <IntegrationSnippet />
        <ChangeTypeMatrix />
        <SupportedTargets />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
