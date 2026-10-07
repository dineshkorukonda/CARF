# CARF Integrations & Target Adapters Architecture

This directory provides production-grade integration guides, manifest templates, and architectural specifications for all deployment orchestrators and runtime execution environments supported by CARF (**Commit-Aware Rollback Framework**).

---

## Supported Integrations Matrix

| Target Adapter | Type | Mode | Health Telemetry | Automated Rollback Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| [**GitHub Actions + PM2**](./github-actions-pm2.md) | CI/CD Pipeline | Augment | HTTP probe + Process restart tracking | GitHub Actions rollback job dispatch (`workflow_dispatch`) |
| [**Argo Rollouts**](./argo-rollouts.md) | K8s Progressive | Augment | CARF AnalysisTemplate / Web probe | Native Argo Rollout abort & revision rollback |
| [**Flagger Canary**](./flagger.md) | Service Mesh | Augment | Flagger rollout webhooks (`/v1/report`) | Native Flagger canary phase rollback & traffic cutoff |
| [**Generic CI / HTTP**](./generic-ci-http.md) | Universal Webhook | Augment | REST API telemetry (`/v1/report`) | Pipeline fail exit-code / webhook dispatch |
| [**Kubernetes (kubectl)**](./kubernetes.md) | Container Orchestration | Standalone | Pod readiness & container restart probe | `kubectl rollout undo deployment/<name>` |
| [**Docker Compose**](./docker-compose.md) | Container Runtime | Standalone | Docker container status & healthcheck probe | Recreate container with previous image tag |
| [**Linux systemd**](./systemd.md) | Linux Host Service | Standalone | `systemctl is-active` & HTTP probe | Git checkout previous SHA + `systemctl restart` |
| [**Prometheus PromQL**](./prometheus.md) | Telemetry & SLO | Augment/Standalone | PromQL dynamic instant query evaluation | Error rate threshold comparison triggering rollback |

---

## Architectural Principles

1. **Commit-Aware Dynamic Thresholds**: Rather than applying static arbitrary error rates, CARF analyzes incoming Git commit AST diffs, test ratios, and churn vectors to dynamically calibrate an adaptive risk ceiling and soak window.
2. **Grace Period Isolation**: All runtime adapters isolate cold-start initialization to prevent false-positive crash-loop rollbacks during deployment startup.
3. **Idempotent Rollback Synchronization**: Distributed rollback calls (from CI pipelines or standalone monitors) acquire atomic state locks to prevent duplicate rollback triggers.
4. **Shell Injection Prevention**: All command-executing runtime adapters sanitize target names, image tags, and namespaces against POSIX/Windows command injection attacks.
