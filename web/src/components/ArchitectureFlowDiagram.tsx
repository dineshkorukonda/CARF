import { GitCommit, Filter, Code2, Database, Gauge, Webhook } from "lucide-react";
import { FlowDiagram } from "./FlowDiagram";

const nodes = [
  { icon: GitCommit, title: "CI Trigger", caption: "Commit SHA + diff" },
  { icon: Filter, title: "Tier 1 Classifier", caption: "Path / manifest match" },
  { icon: Code2, title: "Tier 2 Classifier", caption: "Tree-sitter AST diff" },
  { icon: Database, title: "Vector Persistence", caption: "PostgreSQL" },
  { icon: Gauge, title: "Threshold Computation", caption: "§6.2 formula" },
  { icon: Webhook, title: "Webhook Query", caption: "Argo Rollouts / Flagger" },
];

export function ArchitectureFlowDiagram() {
  return <FlowDiagram nodes={nodes} />;
}
