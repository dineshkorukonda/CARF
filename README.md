# CARF — Change-Aware Rollback Framework

[![core-api CI](https://github.com/dineshkorukonda/CARF/actions/workflows/core-api.yml/badge.svg)](https://github.com/dineshkorukonda/CARF/actions/workflows/core-api.yml)
[![web CI](https://github.com/dineshkorukonda/CARF/actions/workflows/web.yml/badge.svg)](https://github.com/dineshkorukonda/CARF/actions/workflows/web.yml)

CARF (Change-Aware Rollback Framework) is a framework-agnostic decision layer and sidecar protocol for progressive delivery pipelines (such as Argo Rollouts, Flagger, and standalone deployment scripts) that replaces static rollback thresholds with dynamic, risk-calibrated error tolerances computed from commit diffs via deterministic file-path classification and Tree-sitter AST structural complexity parsing.

## Repository layout

```
CARF/
  core-api/    CARF's classification + decision engine (Fastify, TypeScript, Prisma). See core-api/README.md
  web/         Marketing/docs site — landing page, /docs, /paper (Next.js). See web/README.md
  examples/    Argo Rollouts / Flagger augment-mode configs
  docs/        Full design spec (CARF_PROPOSED_IMPLEMENTATION.md)
```

`core-api` and `web` are standalone packages (own lockfile each) — no root workspace.

## Status

| Capability | Status |
| --- | --- |
| Change vector classification (Tier 1 path/manifest + Tier 2 Tree-sitter AST) | Implemented |
| GitHub App webhook receiver (signature auth, diff acquisition) | Implemented |
| Threshold decay engine + persistence | Implemented |
| Augment mode: `GET /v1/threshold` webhook API | Implemented |
| Standalone mode: rollback adapters + health-check loop (Kubernetes, Docker Compose, GitOps/Argo CD) | Implemented |
| Synthetic evaluation harness (H1 proof) | Implemented |
| `.carf.yml` configuration reference (classification rules + threshold/decay tuning; `mode`/`adapter` wired to both Kubernetes and Docker Compose Standalone rollback) | Implemented |
| First-class CI/CD Action (GitHub Actions, wraps `GET /v1/threshold`) | Implemented |
| Additional restoration targets (PM2, Docker Swarm) | Planned |
| Telemetry/observability ingest API | Planned |

See [`web/src/app/docs/page.tsx`](web/src/app/docs/page.tsx) (rendered at `/docs`) for the detailed, per-feature breakdown, and [`docs/CARF_PROPOSED_IMPLEMENTATION.md`](docs/CARF_PROPOSED_IMPLEMENTATION.md) for the full design spec.

## Augment Mode Integration

"Augment mode" lets an existing progressive-delivery pipeline keep its own promotion/rollback mechanics but pull its threshold and evaluation window from CARF instead of a static config value. `core-api` exposes this via a single read endpoint:

```
GET /v1/threshold?commit=<sha>
```

- `200 { finalThreshold: number, finalWindow: number, activeTypes: string[] }` — the risk-calibrated threshold, evaluation window (seconds), and which change categories (`infra`, `dependency`, `config`, `code`) contributed to them, as computed by the threshold engine (`core-api/src/threshold/engine.ts`) for that commit.
- `400 { error: "missing commit query param" }` — the `commit` query param was omitted.
- `404 { error: "commit not found" }` — no `Threshold` row exists yet for that SHA (the commit hasn't been classified via the GitHub webhook pipeline, or the SHA is unknown).

Two example configs show how to wire this into common progressive-delivery tools, both under [`examples/`](examples/):

- [`examples/argo-rollouts-analysistemplate.yaml`](examples/argo-rollouts-analysistemplate.yaml) — an Argo Rollouts `AnalysisTemplate` with a `web` metric provider that calls `GET /v1/threshold` and feeds `finalThreshold`/`finalWindow` into a second metric's success condition and query window.
- [`examples/flagger-webhook-metric.yaml`](examples/flagger-webhook-metric.yaml) — a Flagger `MetricTemplate` (webhook provider) plus a `Canary` excerpt showing both the metric and a `pre-rollout` webhook check hitting the same endpoint; a `400`/`404` response fails the check closed, blocking promotion.

Both examples reference `core-api.carf.svc.cluster.local` as a placeholder in-cluster address — point them at wherever `core-api` is actually reachable in your environment.

## CI/CD Action

For teams driving deploys directly from GitHub Actions rather than a canary tool like Argo Rollouts/Flagger, [`.github/actions/carf-threshold`](.github/actions/carf-threshold/action.yml) is a composite Action wrapping the same `GET /v1/threshold` call — no hand-written `curl`/`jq` needed:

```yaml
- uses: ./.github/actions/carf-threshold
  id: carf
  with:
    api-url: https://your-core-api-host.example.com
    # commit defaults to github.sha; fail-on-missing defaults to true.
- run: echo "threshold ${{ steps.carf.outputs.final-threshold }}, window ${{ steps.carf.outputs.final-window }}s"
```

See [`examples/carf-threshold-action-workflow.yml`](examples/carf-threshold-action-workflow.yml) for a full workflow. GitHub-only for now (no GitLab CI/CircleCI equivalents) — the composite-Action approach (a shell script under the hood) was chosen over a JS/TS Action since it needs no build/bundling step and the underlying call is a single authenticated-free GET request.

## Standalone mode

Where there's no existing progressive-delivery pipeline to augment, `core-api` can drive the rollback itself: `runStandaloneLoop` polls a `RollbackAdapter` for the commit's `finalWindow` and rolls back the moment observed error rate breaches `finalThreshold`. Kubernetes (`kubectl rollout undo`) and Docker Compose adapters are implemented today — see [`core-api/README.md`](core-api/README.md#standalone-mode-rollback-adapters--health-check-loop).

## CI

Two independent GitHub Actions workflows gate changes per package (path-filtered, so a `web/`-only change doesn't run `core-api`'s suite and vice versa):

- [`.github/workflows/core-api.yml`](.github/workflows/core-api.yml) — lint, typecheck, Vitest (against a real Postgres service container; Prisma-backed tests are skipped automatically when `DATABASE_URL` isn't set), and a production build.
- [`.github/workflows/web.yml`](.github/workflows/web.yml) — lint, typecheck, and a production Next.js build.
