# CARF — Change-Aware Rollback Framework

CARF (Change-Aware Rollback Framework) is a framework-agnostic decision layer and sidecar protocol for progressive delivery pipelines (such as Argo Rollouts, Flagger, and standalone deployment scripts) that replaces static rollback thresholds with dynamic, risk-calibrated error tolerances computed from commit diffs via deterministic file-path classification and Tree-sitter AST structural complexity parsing.

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
