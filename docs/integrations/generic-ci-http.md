# Generic CI and HTTP policy

Policy reads and health-report persistence are implemented. Your external pipeline owns deployment, promotion, and rollback execution.

Example `.carf.yml`:

```yaml
mode: augment
deploymentIntegration: generic_http
runtimeAdapter: none
```

Read GET /v1/threshold?commit=<sha> or GET /v1/augment/threshold?owner=<owner>&repo=<repo>&sha=<sha> with Authorization: Bearer <installation API key>. Send POST /v1/report with the same credential and JSON containing commit, owner, repo, errorRate, and optional durationMs.

A report returns action=continue or action=rollback. On rollback, the pipeline must restore its saved previous deployment and verify health. A verdict is persisted in HealthReport, never recorded as an executed RolloutOutcome. Persistence failures return HTTP 503 and should be retried. Supply owner and repo when a SHA can exist in multiple repositories; ambiguity returns HTTP 409.

The GenericHttpIntegration library can send notifications, but neither a notification nor its in-memory status proves rollback execution. No Jenkins/GitLab/CircleCI live acceptance run is claimed.
