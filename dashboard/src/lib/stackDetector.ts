export type DetectedStack = "pm2" | "generic";

export interface StackDetectionResult {
  stack: DetectedStack;
  label: string;
  badge: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  suggestedMode: "augment" | "standalone";
  sampleYml: string;
  ciSnippetTitle: string;
  ciSnippet: string;
}

export function detectStackFromRepo(
  repoName: string,
  fileNames: string[] = []
): StackDetectionResult {
  const lowerFiles = fileNames.map((f) => f.toLowerCase());
  const lowerRepo = repoName.toLowerCase();

  // Check for PM2 / Node server layout
  const isPm2 =
    lowerFiles.some((f) => f.includes("ecosystem.config") || f.includes("pm2")) ||
    lowerRepo.includes("server") ||
    lowerRepo.includes("api");

  if (isPm2) {
    return {
      stack: "pm2",
      label: "Node.js + PM2",
      badge: "Standalone Mode",
      reason: "Detected PM2 configuration or Node.js server architecture",
      confidence: "high",
      suggestedMode: "standalone",
      sampleYml: `# .carf.yml
version: "1.0"
mode: standalone
adapter:
  kind: pm2
  target: api-server
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 3.5
  observation_window_seconds: 300
`,
      ciSnippetTitle: "PM2 Deploy Script Check",
      ciSnippet: `pm2 reload api-server && sleep 5 && pm2 show api-server`,
    };
  }

  // Default Generic Stack (Augment Mode)
  return {
    stack: "generic",
    label: "Web Application / API",
    badge: "Augment Mode",
    reason: "Standard git repository",
    confidence: "medium",
    suggestedMode: "augment",
    sampleYml: `# .carf.yml
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 3.0
  observation_window_seconds: 240
`,
    ciSnippetTitle: "Dynamic Risk Threshold Query",
    ciSnippet: `curl -s "https://carf.indevs.in/v1/threshold?commit=\${COMMIT_SHA}"`,
  };
}
