export type DetectedStack = "vercel" | "render" | "pm2" | "docker" | "k8s" | "serverless" | "generic";

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

  // 1. Check for Next.js / Vercel
  const isVercel =
    lowerFiles.some((f) => f.includes("next.config") || f === "vercel.json") ||
    lowerRepo.includes("next") ||
    lowerRepo.includes("web") ||
    lowerRepo.includes("frontend");

  if (isVercel) {
    return {
      stack: "vercel",
      label: "Next.js / Vercel Frontend",
      badge: "Advisory / Augment",
      reason: "Detected Next.js or Vercel configuration files",
      confidence: "high",
      suggestedMode: "augment",
      sampleYml: `# .carf.yml
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 4.0
  observation_window_seconds: 180
rules:
  - name: api-routes
    pattern: "src/app/api/**/*.{ts,js}"
    weight: 1.5
`,
      ciSnippetTitle: "Vercel PR Risk Check",
      ciSnippet: `curl -s "https://carf.indevs.in/v1/threshold?commit=\${COMMIT_SHA}"`,
    };
  }

  // 2. Check for Kubernetes / Argo
  const isK8s =
    lowerFiles.some((f) => f.startsWith("k8s/") || f.startsWith("helm/") || f.includes("rollout.y")) ||
    lowerRepo.includes("k8s") ||
    lowerRepo.includes("infra");

  if (isK8s) {
    return {
      stack: "k8s",
      label: "Kubernetes / Argo Rollouts",
      badge: "Augment / Webhook",
      reason: "Detected Kubernetes manifests or Helm charts",
      confidence: "high",
      suggestedMode: "augment",
      sampleYml: `# .carf.yml
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 3.0
  observation_window_seconds: 300
`,
      ciSnippetTitle: "Argo AnalysisTemplate Webhook",
      ciSnippet: `url: "https://carf.indevs.in/v1/threshold?commit={{args.commit-sha}}"`,
    };
  }

  // 3. Check for PM2 / VPS layout
  const isPm2 =
    lowerFiles.some((f) => f.includes("ecosystem.config") || f.includes("pm2")) ||
    lowerRepo.includes("versiongate") ||
    lowerRepo.includes("server") ||
    lowerRepo.includes("api");

  if (isPm2) {
    return {
      stack: "pm2",
      label: "Node.js + PM2 (VPS / Server)",
      badge: "Standalone or Augment",
      reason: "Detected Node server / PM2 process architecture",
      confidence: "high",
      suggestedMode: "augment",
      sampleYml: `# .carf.yml
version: "1.0"
mode: augment
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 3.5
  observation_window_seconds: 300
`,
      ciSnippetTitle: "PM2 Deploy Script Check",
      ciSnippet: `pm2 reload api-server && sleep 5 && pm2 show api-server`,
    };
  }

  // 4. Check for Docker Compose
  const isDocker = lowerFiles.some((f) => f.includes("docker-compose") || f === "dockerfile");
  if (isDocker) {
    return {
      stack: "docker",
      label: "Docker Compose",
      badge: "Standalone",
      reason: "Detected Docker Compose file",
      confidence: "high",
      suggestedMode: "standalone",
      sampleYml: `# .carf.yml
version: "1.0"
mode: standalone
adapter:
  kind: dockerCompose
  target: web
`,
      ciSnippetTitle: "Docker Compose Zero-Downtime Rollback",
      ciSnippet: `IMAGE_TAG=\${PREV_SHA} docker compose up -d web`,
    };
  }

  // 5. Default Generic Stack
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
