# CARF — Change-Aware Rollback Framework

CARF (Change-Aware Rollback Framework) is a hosted DevOps platform and execution engine that automates post-deployment verification and contextual rollback decisions. Unlike conventional continuous delivery systems that evaluate post-deploy telemetry against flat failure metrics, CARF inspects AST syntax trees and unified git diffs prior to telemetry ingestion. By classifying releases into application code, runtime configuration, dependency lockfiles, or infrastructure manifests, CARF dynamically synthesizes adaptive observation windows and error variance ceilings, preventing false-alarm rollbacks while ensuring instantaneous recovery during high-risk environment or system changes.

The framework integrates directly into existing continuous integration pipelines and cloud-native container orchestrators. Upon commit ingestion, CARF evaluates incoming metric streams from Prometheus, Datadog, or OpenTelemetry against configured vector sensitivity rules. When error rates or latency anomalies cross a vector's mathematical threshold, CARF dispatches zero-downtime rollback primitives to target controllers such as Kubernetes, PM2, Docker Swarm, or GitOps operators in under 500 milliseconds.

## Entity-Relationship Diagram

```mermaid
erDiagram
    PROJECT ||--o{ CHANGE_VECTOR : classifies
    PROJECT ||--o{ SENSITIVITY_RULE : configures
    PROJECT ||--o{ DEPLOYMENT : executes
    DEPLOYMENT ||--|| CHANGE_VECTOR : contains
    DEPLOYMENT ||--o{ TELEMETRY_STREAM : monitors
    TELEMETRY_STREAM ||--|| DECISION_ENGINE : evaluates
    SENSITIVITY_RULE ||--|| DECISION_ENGINE : governs
    DECISION_ENGINE ||--o| ROLLBACK_EXECUTION : triggers
    ROLLBACK_EXECUTION ||--|| TARGET_RUNTIME : restores

    PROJECT {
        string project_id PK
        string name
        string runtime_provider
    }
    CHANGE_VECTOR {
        string vector_id PK
        string type "CODE | CONFIG | DEPENDENCY | INFRASTRUCTURE"
        string git_commit_sha
        string diff_summary
    }
    SENSITIVITY_RULE {
        string rule_id PK
        string vector_type
        int window_seconds
        float error_threshold_pct
        string action_policy
    }
    DEPLOYMENT {
        string deployment_id PK
        string environment
        timestamp deployed_at
        string status
    }
    TELEMETRY_STREAM {
        string stream_id PK
        float http_5xx_rate
        float latency_p99_ms
        timestamp sampled_at
    }
    DECISION_ENGINE {
        string decision_id PK
        boolean threshold_breached
        float calculated_metric
        timestamp evaluated_at
    }
    ROLLBACK_EXECUTION {
        string execution_id PK
        string target_revision
        int latency_ms
        string status
    }
    TARGET_RUNTIME {
        string runtime_id PK
        string provider "KUBERNETES | PM2 | GITOPS | DOCKER"
        string endpoint
    }
```
