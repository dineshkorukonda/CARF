/**
 * Canonical CARF Augment workflow template for GitHub Actions.
 *
 * This is the single source of truth for the YAML CARF installs into a repository
 * (`.github/workflows/carf.yml`). The dashboard UI never duplicates it -- the manual
 * "Advanced" view fetches the rendered template from the backend.
 *
 * Augment projects read policy only. Standalone PM2 projects wait for successful
 * push CI, request exact-SHA deployment, and report the observation/rollback outcome.
 */

export const CARF_WORKFLOW_PATH = ".github/workflows/carf.yml";
export const CARF_WORKFLOW_MARKER = "# CARF-MANAGED-WORKFLOW";
export const CARF_WORKFLOW_VERSION = 3;
/** Name of the GitHub Actions repository secret CARF configures automatically. */
export const CARF_SECRET_NAME = "CARF_API_KEY";

export interface WorkflowTemplateInput {
  /** Public CARF API origin, no trailing slash (e.g. https://carf.indevs.in). */
  coreApiUrl: string;
  /** Branch whose pushes should trigger the policy job (the repo default branch). */
  branch: string;
  /** Standalone PM2 projects deploy only after this CI workflow succeeds. */
  managedPm2?: boolean;
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

/** True when the host is loopback/private/link-local, i.e. unreachable from GitHub-hosted runners. */
export function isPrivateHostUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "[::1]" || host === "::1") return true;
  const m = host.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Renders the canonical workflow. Values are validated first so nothing can break out of the YAML. */
export function renderCarfWorkflow(input: WorkflowTemplateInput): string {
  assertSafeInput(input);
  const url = input.coreApiUrl.replace(/\/+$/, "");
  if (input.managedPm2) return `${CARF_WORKFLOW_MARKER}
# version: ${CARF_WORKFLOW_VERSION}
# CARF deploys the exact SHA only after the named CI workflow succeeds.
name: CARF PM2 Deployment
run-name: CARF PM2 deploy \${{ github.event.workflow_run.head_sha }}

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

permissions:
  contents: read

concurrency:
  group: carf-pm2-\${{ github.repository }}
  cancel-in-progress: false

jobs:
  carf-deploy:
    outputs:
      rollback_id: \${{ steps.observe.outputs.rollback_id }}
    if: >-
      github.event.workflow_run.conclusion == 'success' &&
      github.event.workflow_run.event == 'push' &&
      github.event.workflow_run.head_branch == '${input.branch}' &&
      github.event.workflow_run.head_repository.full_name == github.repository
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      CARF_API_URL: ${url}
      CARF_API_KEY: \${{ secrets.${CARF_SECRET_NAME} }}
      CARF_OWNER: \${{ github.repository_owner }}
      CARF_REPO: \${{ github.event.repository.name }}
      CARF_BRANCH: ${input.branch}
      CARF_SHA: \${{ github.event.workflow_run.head_sha }}
      CARF_CI_RUN_ID: \${{ github.event.workflow_run.id }}
    steps:
      - name: Get CARF policy
        run: |
          set -euo pipefail
          for attempt in {1..12}; do
            status=$(curl -sS -G "$CARF_API_URL/v1/augment/threshold" \\
              --data-urlencode "owner=$CARF_OWNER" \\
              --data-urlencode "repo=$CARF_REPO" \\
              --data-urlencode "sha=$CARF_SHA" \\
              -H "Authorization: Bearer $CARF_API_KEY" \\
              -o carf-policy.json -w '%{http_code}' || echo 000)
            if [ "$status" = "200" ]; then break; fi
            if [ "$status" = "401" ]; then echo "::error::CARF rejected the repository secret"; exit 1; fi
            echo "CARF policy pending for $CARF_SHA (HTTP $status), attempt $attempt/12"
            sleep 5
          done
          if [ "$status" != "200" ]; then echo "::error::CARF policy unavailable for $CARF_SHA (HTTP $status)"; exit 1; fi
          echo "Policy: threshold=$(jq -r '.threshold' carf-policy.json), window=$(jq -r '.window' carf-policy.json)s"
      - name: Deploy exact commit with CARF and PM2
        run: |
          set -euo pipefail
          payload=$(jq -n --arg owner "$CARF_OWNER" --arg repo "$CARF_REPO" --arg branch "$CARF_BRANCH" --arg sha "$CARF_SHA" --argjson ciRunId "$CARF_CI_RUN_ID" '{owner:$owner,repo:$repo,branch:$branch,expectedSha:$sha,ciRunId:$ciRunId,observeLive:true,rollbackViaActions:true}')
          curl --fail-with-body -sS -X POST "$CARF_API_URL/v1/commits/refresh" \\
            -H "Authorization: Bearer $CARF_API_KEY" -H "Content-Type: application/json" \\
            --data "$payload" -o carf-deploy.json
          if [ "$(jq '.failed | length' carf-deploy.json)" != "0" ]; then
            jq -r '.failed[] | "::error::CARF deployment failed for \\(.sha): \\(.error)"' carf-deploy.json
            # A failed build can still require restoration by the rollback job.
            curl --fail-with-body -sS -G "$CARF_API_URL/v1/rollouts/status" \\
              --data-urlencode "owner=$CARF_OWNER" --data-urlencode "repo=$CARF_REPO" --data-urlencode "sha=$CARF_SHA" \\
              -H "Authorization: Bearer $CARF_API_KEY" -o carf-rollout.json
            if [ "$(jq -r '.status' carf-rollout.json)" != "ROLLBACK_REQUIRED" ]; then exit 1; fi
          fi
          echo "CARF deployment requested for $CARF_SHA"
      - name: Wait for observation and rollback decision
        id: observe
        run: |
          set -euo pipefail
          for attempt in {1..300}; do
            status=$(curl -sS -G "$CARF_API_URL/v1/rollouts/status" \\
              --data-urlencode "owner=$CARF_OWNER" \\
              --data-urlencode "repo=$CARF_REPO" \\
              --data-urlencode "sha=$CARF_SHA" \\
              -H "Authorization: Bearer $CARF_API_KEY" \\
              -o carf-rollout.json -w '%{http_code}' || echo 000)
            if [ "$status" = "200" ]; then
              result=$(jq -r '.status' carf-rollout.json)
              case "$result" in
                SUCCESS) echo "CARF verified $CARF_SHA healthy"; exit 0 ;;
                ROLLBACK_REQUIRED)
                  rollout_id=$(jq -er '.id | select(type == "string" and test("^[A-Za-z0-9_-]+$"))' carf-rollout.json)
                  echo "rollback_id=$rollout_id" >> "$GITHUB_OUTPUT"
                  echo "CARF requested rollback; handing execution to the rollback job"
                  exit 0 ;;
                ROLLED_BACK|FAILED) jq -r '"::error::CARF rollout " + .status + ": " + (.reason // "unknown reason")' carf-rollout.json; exit 1 ;;
              esac
            elif [ "$status" = "401" ]; then echo "::error::CARF authentication failed"; exit 1
            elif [ "$status" != "404" ]; then echo "CARF rollout status HTTP $status"
            fi
            sleep 5
          done
          echo "::error::CARF did not finish observing $CARF_SHA in 25 minutes"
          exit 1

  carf-rollback:
    name: Rollback to previous healthy release
    needs: carf-deploy
    if: needs.carf-deploy.outputs.rollback_id != ''
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      CARF_API_URL: ${url}
      CARF_API_KEY: \${{ secrets.${CARF_SECRET_NAME} }}
      CARF_ROLLOUT_ID: \${{ needs.carf-deploy.outputs.rollback_id }}
    steps:
      - name: Restore previous revision, rebuild, reload PM2, and verify health
        run: |
          set -euo pipefail
          curl --fail-with-body --max-time 1100 -sS -X POST "$CARF_API_URL/v1/rollouts/$CARF_ROLLOUT_ID/rollback" \\
            -H "Authorization: Bearer $CARF_API_KEY" -H "Content-Type: application/json" \\
            --data '{"automatic":true}' -o carf-recovery.json
          jq -e '.success == true and .status == "ROLLED_BACK"' carf-recovery.json >/dev/null
          jq -r '.message' carf-recovery.json
          echo "### Rollback completed and health verified" >> "$GITHUB_STEP_SUMMARY"
          jq -r '.message' carf-recovery.json >> "$GITHUB_STEP_SUMMARY"

  carf-result:
    name: Deployment result
    needs: [carf-deploy, carf-rollback]
    if: always() && needs.carf-deploy.result != 'skipped'
    runs-on: ubuntu-latest
    env:
      DEPLOY_RESULT: \${{ needs.carf-deploy.result }}
      ROLLBACK_ID: \${{ needs.carf-deploy.outputs.rollback_id }}
      ROLLBACK_RESULT: \${{ needs.carf-rollback.result }}
    steps:
      - name: Report deployment outcome
        run: |
          if [ -n "$ROLLBACK_ID" ]; then
            echo "::error::Deployment rejected; rollback job result: $ROLLBACK_RESULT"
            exit 1
          fi
          if [ "$DEPLOY_RESULT" != "success" ]; then exit 1; fi
          echo "Deployment promoted"
`;
  return `${CARF_WORKFLOW_MARKER}
# version: 1
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
  triggersDeployment: boolean;
  waitsForCi: boolean;
  executesRollback: boolean;
}

/** Static verification that an installed workflow targets the expected CARF integration. */
export function checkWorkflowContent(content: string, coreApiUrl: string): WorkflowChecks {
  return {
    hasMarker: inspectExistingWorkflow(content).kind === "managed",
    usesAugmentEndpoint: content.includes("/v1/augment/threshold"),
    referencesSecret: content.includes(`secrets.${CARF_SECRET_NAME}`),
    referencesCarfApi: content.includes(coreApiUrl.replace(/\/+$/, "")),
    triggersDeployment: content.includes("/v1/commits/refresh") && content.includes("observeLive:true"),
    waitsForCi: content.includes("workflow_run:") && content.includes("conclusion == 'success'"),
    executesRollback: content.includes("carf-rollback:") && content.includes("rollbackViaActions:true") && content.includes('/rollback"') && content.includes('"automatic":true'),
  };
}
