# Prometheus PromQL Telemetry Health Adapter Guide

The Prometheus PromQL adapter enables CARF to query Prometheus or VictoriaMetrics instant query APIs (`/api/v1/query`) to dynamically evaluate real-time HTTP error rates, 5xx ratios, and latency percentiles against dynamic risk thresholds.

---

## Architectural Flow

```mermaid
sequenceDiagram
    participant Deploy as Deployment Runner
    participant CARF as CARF Engine
    participant Prom as Prometheus / VictoriaMetrics
    participant Target as Production Workload

    Target->>Prom: Scrape metrics (http_requests_total)
    Deploy->>CARF: Rollout initiated
    loop Soak Window (e.g. 5m)
        CARF->>Prom: GET /api/v1/query?query={promql_expression}
        Prom-->>CARF: Return scalar/vector value (e.g. 0.012)
        CARF->>CARF: Compare errorRate against Dynamic Threshold
    end
    alt Error rate <= Threshold
        CARF-->>Deploy: Rollout Healthy (Continue)
    else Error rate > Threshold
        CARF-->>Deploy: Breach detected! Initiate automated rollback
    end
```

---

## Configuration (`.carf.yml`)

```yaml
version: "1.0"
mode: "augment"

telemetry:
  source: "prometheus"
  endpoint: "http://prometheus:9090"
  query: 'sum(rate(http_requests_total{job="api",status=~"5.."}[1m])) / sum(rate(http_requests_total{job="api"}[1m]))'
  timeout_ms: 5000

rules:
  window_seconds: 300
  base_ceiling: 0.02
```

---

## Useful PromQL Query Recipes

### 1. HTTP 5xx Error Rate Ratio
```promql
sum(rate(http_requests_total{service="my-service",status=~"5.."}[1m]))
/
sum(rate(http_requests_total{service="my-service"}[1m]))
```

### 2. High Error Rate Absolute Rate
```promql
sum(rate(http_requests_total{service="my-service",status=~"5.."}[1m]))
```

### 3. P99 Latency Breach Threshold (seconds)
```promql
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service="my-service"}[5m])) by (le))
```
