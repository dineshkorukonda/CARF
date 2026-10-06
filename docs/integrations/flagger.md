# Flagger Canary Integration Guide

This guide details configuring **Flagger** with CARF webhooks for progressive traffic shifting and automated rollbacks on Istio, Linkerd, Contour, or NGINX.

---

## Architectural Flow

```mermaid
sequenceDiagram
    participant Deploy as Deployment Update
    participant Flagger as Flagger Operator
    participant CARF as CARF Core API
    participant Mesh as Ingress / Service Mesh

    Deploy->>Flagger: Image revision changed
    Flagger->>Mesh: Initialize canary pod (weight 10%)
    loop Iteration (interval 1m)
        Flagger->>CARF: Webhook POST /v1/report
        CARF-->>Flagger: HTTP 200 { status: "continue" }
        Flagger->>Mesh: Increase weight (+10%)
    end
    alt Metrics succeed
        Flagger->>Mesh: Route 100% traffic to primary
    else Breach occurs
        Flagger->>Mesh: Reset weight to 0% (Canary Failed)
    end
```

---

## Canary CRD Manifest (`flagger-canary.yaml`)

```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: api-service
  namespace: default
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  service:
    port: 8080
    targetPort: 8080
  analysis:
    interval: 1m
    threshold: 2
    maxWeight: 50
    stepWeight: 10
    webhooks:
      - name: "carf-soak-verification"
        type: rollout
        url: "https://api.carf.dev/v1/report"
        timeout: 10s
        headers:
          Authorization: "Bearer YOUR_CARF_API_KEY"
```
