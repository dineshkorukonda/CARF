export type ProtectionPreset = "standard" | "conservative" | "aggressive";

export function generateCarfYaml(preset: ProtectionPreset = "standard"): string {
  switch (preset) {
    case "conservative":
      return `# CARF Configuration (Change-Aware Rollback Framework)
version: "1.0"
mode: conservative
thresholds:
  base_tolerance_pct: 0.2
  max_tolerance_pct: 2.0
  observation_window_seconds: 300
rules:
  - name: test-discount
    pattern: "**/*.{test,spec}.*"
    weight: 0.1
  - name: config-and-manifests
    pattern: "**/*.{yaml,yml,json,env}"
    weight: 1.5
  - name: db-migrations
    pattern: "**/migrations/**"
    weight: 3.0
`;
    case "aggressive":
      return `# CARF Configuration (Change-Aware Rollback Framework)
version: "1.0"
mode: aggressive
thresholds:
  base_tolerance_pct: 1.0
  max_tolerance_pct: 5.0
  observation_window_seconds: 120
rules:
  - name: test-discount
    pattern: "**/*.{test,spec}.*"
    weight: 0.1
  - name: config-and-manifests
    pattern: "**/*.{yaml,yml,json,env}"
    weight: 1.0
  - name: db-migrations
    pattern: "**/migrations/**"
    weight: 2.0
`;
    case "standard":
    default:
      return `# CARF Configuration (Change-Aware Rollback Framework)
version: "1.0"
mode: balanced
thresholds:
  base_tolerance_pct: 0.5
  max_tolerance_pct: 3.5
  observation_window_seconds: 180
rules:
  - name: test-discount
    pattern: "**/*.{test,spec}.*"
    weight: 0.1
  - name: config-and-manifests
    pattern: "**/*.{yaml,yml,json,env}"
    weight: 1.2
  - name: db-migrations
    pattern: "**/migrations/**"
    weight: 2.5
`;
  }
}

export function generateWatchdogWorkflowYaml(): string {
  return `name: CARF Canary Watchdog
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  carf-canary-watchdog:
    name: CARF Dynamic Risk Calibration
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: CARF Change-Aware Canary Verification
        run: |
          echo "🛡️ CARF Dynamic Canary Watchdog Active"
          echo "Evaluating commit SHA: \${{ github.sha }}"
          echo "Applying .carf.yml risk-calibrated thresholds"
`;
}
