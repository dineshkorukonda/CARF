# Prometheus and PromQL telemetry

PromQLAdapter implements instant-query parsing and threshold comparison as a library adapter with unit tests. It is not wired into the managed standalone .carf.yml schema. There is no live Prometheus acceptance result in the repository.

Example `.carf.yml` for external metric reporting:

```yaml
mode: augment
deploymentIntegration: generic_http
runtimeAdapter: none
```

An external pipeline can query Prometheus for an error-rate ratio, then submit commit, owner, repo, and errorRate to authenticated POST /v1/report. On action=rollback, the pipeline restores its previous deployment and verifies recovery. Do not add undocumented telemetry/promql keys to .carf.yml: unknown fields are rejected.

GET /metrics exposes CARF process counters. Prometheus scraping those counters is separate from using application PromQL as a rollout health source.
