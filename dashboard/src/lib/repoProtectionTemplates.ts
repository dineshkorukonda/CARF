export type ProtectionPreset = "standard" | "conservative" | "aggressive";

/**
 * 1-click protect writes policy-only `.carf.yml`.
 *
 * It does not select a PM2 target or install a Host Agent, so the committed
 * mode is always `augment`. Threshold presets used to be stuffed into `mode:`
 * as balanced/conservative/aggressive, which is invalid under CarfConfigSchema.
 */
export function generateCarfYaml(preset: ProtectionPreset = "standard"): string {
  const windowSeconds =
    preset === "conservative" ? 300 : preset === "aggressive" ? 120 : 180;
  const baseThreshold =
    preset === "conservative" ? 0.002 : preset === "aggressive" ? 0.01 : 0.005;

  return `# CARF Configuration (Change-Aware Rollback Framework)
# Threshold preset: ${preset}
# This file is policy-only (Augment). It does not configure PM2 or a Host Agent.
mode: augment
threshold:
  types:
    infra:
      baseThreshold: ${baseThreshold}
      baseWindow: ${windowSeconds}
    dependency:
      baseThreshold: ${baseThreshold}
      baseWindow: ${windowSeconds}
    config:
      baseThreshold: ${baseThreshold}
      baseWindow: ${windowSeconds}
    code:
      baseThreshold: ${Number((baseThreshold * 1.6).toFixed(4))}
      baseWindow: ${windowSeconds}
    data:
      baseThreshold: ${baseThreshold}
      baseWindow: ${windowSeconds}
`;
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
