/**
 * Canonical CARF Augment workflow template for GitHub Actions.
 *
 * This is the single source of truth for the YAML CARF installs into a repository
 * (`.github/workflows/carf.yml`). The dashboard UI never duplicates it -- the manual
 * "Advanced" view fetches the rendered template from the backend.
 *
 * Augment contract: the workflow only *reads* CARF policy (threshold / window /
 * changeVector) for the exact commit being built. It never starts a host agent,
 * touches PM2, monitors health, creates rollout records, or triggers rollback --
 * the external deployment system owns all of that.
 */

export const CARF_WORKFLOW_PATH = ".github/workflows/carf.yml";
export const CARF_WORKFLOW_MARKER = "# CARF-MANAGED-WORKFLOW";
export const CARF_WORKFLOW_VERSION = 1;
/** Name of the GitHub Actions repository secret CARF configures automatically. */
export const CARF_SECRET_NAME = "CARF_API_KEY";

export interface WorkflowTemplateInput {
  /** Public CARF API origin, no trailing slash (e.g. https://carf.indevs.in). */
  coreApiUrl: string;
  /** Branch whose pushes should trigger the policy job (the repo default branch). */
  branch: string;
}

export class InvalidWorkflowInputError extends Error {}

function assertSafeInput(input: WorkflowTemplateInput): void {
  if (!/^https?:\/\/[A-Za-z0-9.\-:_\/]+$/.test(input.coreApiUrl)) {
    throw new InvalidWorkflowInputError("CARF API URL contains unsupported characters");
  }
  if (!/^[A-Za-z0-9._\-\/]+$/.test(input.branch)) {
    throw new InvalidWorkflowInputError("Branch name contains unsupported characters");
  }
}

/** Renders the canonical workflow. Values are validated first so nothing can break out of the YAML. */
export function renderCarfWorkflow(input: WorkflowTemplateInput): string {
  assertSafeInput(input);
  const url = input.coreApiUrl.replace(/\/+$/, "");
  return `${CARF_WORKFLOW_MARKER}
# version: ${CARF_WORKFLOW_VERSION}
# Generated and kept up to date by CARF.
# Augment mode: this workflow only fetches change-aware deployment policy.
# Your own deployment steps consume the outputs below and remain responsible for deployment.
name: CARF Augment Policy

on:
  push:
    branches:
      - ${input.branch}
  workflow_dispatch:

permissions:
  contents: read

jobs:
  carf-policy:
    runs-on: ubuntu-latest
    outputs:
      threshold: \${{ steps.carf.outputs.threshold }}
      window: \${{ steps.carf.outputs.window }}
      change_vector: \${{ steps.carf.outputs.change_vector }}
    steps:
      - name: Get CARF policy
        id: carf
        env:
          CARF_API_URL: ${url}
          CARF_API_KEY: \${{ secrets.${CARF_SECRET_NAME} }}
          CARF_OWNER: \${{ github.repository_owner }}
          CARF_REPO: \${{ github.event.repository.name }}
          CARF_SHA: \${{ github.sha }}
        run: |
          set -euo pipefail
          # CARF classifies the pushed commit via its GitHub webhook; retry briefly while it arrives.
          for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
            status=$(curl -sS -G "$CARF_API_URL/v1/augment/threshold" \\
              --data-urlencode "owner=$CARF_OWNER" \\
              --data-urlencode "repo=$CARF_REPO" \\
              --data-urlencode "sha=$CARF_SHA" \\
              -H "Authorization: Bearer $CARF_API_KEY" \\
              -o carf-policy.json -w '%{http_code}' || echo 000)
            if [ "$status" = "200" ]; then break; fi
            if [ "$status" = "401" ]; then
              echo "::error::CARF rejected the credentials. Re-run 'Reconfigure' for this repository in the CARF dashboard."
              exit 1
            fi
            echo "CARF policy not ready yet (HTTP $status), attempt $attempt/12"
            sleep 5
          done
          if [ "$status" != "200" ]; then
            echo "::error::CARF policy unavailable for $CARF_SHA (last HTTP status $status)"
            exit 1
          fi
          threshold=$(jq -r '.threshold' carf-policy.json)
          window=$(jq -r '.window' carf-policy.json)
          change_vector=$(jq -c '.changeVector' carf-policy.json)
          echo "threshold=$threshold" >> "$GITHUB_OUTPUT"
          echo "window=$window" >> "$GITHUB_OUTPUT"
          echo "change_vector=$change_vector" >> "$GITHUB_OUTPUT"
          echo "CARF_THRESHOLD=$threshold" >> "$GITHUB_ENV"
          echo "CARF_WINDOW=$window" >> "$GITHUB_ENV"
          echo "CARF_CHANGE_VECTOR=$change_vector" >> "$GITHUB_ENV"
          echo "CARF policy for $CARF_SHA: threshold=$threshold window=\${window}s"
      # Consume from later jobs with: needs.carf-policy.outputs.threshold / .window / .change_vector
`;
}

export type WorkflowOwnership =
  | { kind: "absent" }
  | { kind: "managed"; version: number | null }
  | { kind: "foreign" };

/** Classifies an existing `.github/workflows/carf.yml` so CARF never overwrites unrelated user config. */
export function inspectExistingWorkflow(content: string | null): WorkflowOwnership {
  if (content === null) return { kind: "absent" };
  const firstLines = content.split(/\r?\n/).slice(0, 5);
  if (!firstLines.some((line) => line.trim() === CARF_WORKFLOW_MARKER)) return { kind: "foreign" };
  const versionLine = content.match(/^# version:\s*(\d+)\s*$/m);
  return { kind: "managed", version: versionLine ? Number(versionLine[1]) : null };
}

/** Normalizes line endings for byte-for-byte idempotency comparisons. */
export function workflowsEqual(a: string, b: string): boolean {
  return a.replace(/\r\n/g, "\n").trimEnd() === b.replace(/\r\n/g, "\n").trimEnd();
}

export interface WorkflowChecks {
  hasMarker: boolean;
  usesAugmentEndpoint: boolean;
  referencesSecret: boolean;
  referencesCarfApi: boolean;
}

/** Static verification that an installed workflow targets the expected CARF integration. */
export function checkWorkflowContent(content: string, coreApiUrl: string): WorkflowChecks {
  return {
    hasMarker: inspectExistingWorkflow(content).kind === "managed",
    usesAugmentEndpoint: content.includes("/v1/augment/threshold"),
    referencesSecret: content.includes(`secrets.${CARF_SECRET_NAME}`),
    referencesCarfApi: content.includes(coreApiUrl.replace(/\/+$/, "")),
  };
}
