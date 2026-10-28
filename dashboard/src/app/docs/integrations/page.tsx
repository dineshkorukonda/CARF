import type { Metadata } from "next";
import IntegrationsExplorer from "./IntegrationsExplorer";

export const metadata: Metadata = {
  title: "Integration guides | CARF Docs",
  description: "Explore CARF deployment integrations, runtime adapters, setup guides, sample configurations, and recovery simulations.",
};

export default function IntegrationsDocsPage() {
  return <IntegrationsExplorer />;
}
