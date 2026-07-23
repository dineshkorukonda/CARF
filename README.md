# CARF — Change-Aware Rollback Framework

CARF (Change-Aware Rollback Framework) is a hosted DevOps platform and execution engine that automates post-deployment verification and contextual rollback decisions. Unlike conventional continuous delivery systems that evaluate post-deploy telemetry against flat failure metrics, CARF inspects AST syntax trees and unified git diffs prior to telemetry ingestion. By classifying releases into application code, runtime configuration, dependency lockfiles, or infrastructure manifests, CARF dynamically synthesizes adaptive observation windows and error variance ceilings, preventing false-alarm rollbacks while ensuring instantaneous recovery during high-risk environment or system changes.

The framework integrates directly into existing continuous integration pipelines and cloud-native container orchestrators. Upon commit ingestion, CARF evaluates incoming metric streams from Prometheus, Datadog, or OpenTelemetry against configured vector sensitivity rules. When error rates or latency anomalies cross a vector's mathematical threshold, CARF dispatches zero-downtime rollback primitives to target controllers such as Kubernetes, PM2, Docker Swarm, or GitOps operators in under 500 milliseconds.

## Framework Execution Flow

```mermaid
flowchart TD
    A[Git Commit Push / Diff] --> B[AST Change Classifier]
    
    B -->|Parses File Paths & AST| C{Change Vector Tag}
    C -->|Code: .ts, .go, .py| D1[Low Sensitivity / 15m Window]
    C -->|Config: .env, config.json| D2[Medium Sensitivity / 5m Window]
    C -->|Dependency: lockfiles| D3[High Sensitivity / 3m Window]
    C -->|Infra: k8s, helm, terraform| D4[Strictest Sensitivity / 60s Window]
    
    D1 --> E[Observability Stream Ingestion]
    D2 --> E
    D3 --> E
    D4 --> E
    
    E -->|Prometheus / Datadog / OTEL| F[CARF Contextual Decision Engine]
    
    F -->|Telemetry <= Threshold| G[Maintain Deployment & Log Baseline]
    F -->|Telemetry > Threshold| H[Trigger Automated Rollback]
    
    H --> I[Rollback Executor < 500ms]
    
    I -->|kubectl rollout undo| J1[Kubernetes Cluster]
    I -->|pm2 reload| J2[PM2 Process Manager]
    I -->|git revert commit| J3[GitOps ArgoCD / Flux]
    I -->|container swap| J4[Docker Engine / Swarm]
```
