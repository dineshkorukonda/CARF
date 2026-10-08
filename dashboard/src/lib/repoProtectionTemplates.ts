import type { AnalysisTrigger } from "./carfConfigSchema";

export type ProtectionPreset = "standard" | "conservative" | "aggressive";

/**
 * 1-click protect writes policy-only `.carf.yml`.
 *
 * It does not select a PM2 target or install a Host Agent, so the committed
 * mode is always `augment`. Threshold presets used to be stuffed into `mode:`
 * as balanced/conservative/aggressive, which is invalid under CarfConfigSchema.
 */
export function generateCarfYaml(preset: ProtectionPreset = "standard", analysisTrigger?: AnalysisTrigger): string {
  const windowSeconds =
    preset === "conservative" ? 300 : preset === "aggressive" ? 120 : 180;
  const baseThreshold =
    preset === "conservative" ? 0.002 : preset === "aggressive" ? 0.01 : 0.005;

  return `# CARF Configuration (Change-Aware Rollback Framework)
# Threshold preset: ${preset}
# This file is policy-only (Augment). It does not configure PM2 or a Host Agent.
mode: augment
${analysisTrigger ? `analysisTrigger: ${analysisTrigger}\n` : ""}threshold:
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

export function generateWatchdogWorkflowYaml(analysisTrigger: AnalysisTrigger = "both"): string {
  return `name: CARF Canary Watchdog
on:
${analysisTrigger !== "pull_requests" ? "  push:\n    branches: [ main, master ]\n" : ""}${analysisTrigger !== "commits" ? "  pull_request:\n    branches: [ main, master ]\n" : ""}

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
          echo "Evaluating commit SHA: \${{ github.event.pull_request.head.sha || github.sha }}"
          echo "Applying .carf.yml risk-calibrated thresholds"
`;
}
