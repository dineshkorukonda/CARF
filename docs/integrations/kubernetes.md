# Kubernetes (kubectl) Runtime Adapter Guide

The Kubernetes adapter enables automated rollback execution directly against Kubernetes `Deployment` resources via `kubectl rollout undo` and pod readiness monitoring.

---

## Capabilities

- **Automatic Rollback**: `kubectl rollout undo deployment/<name> -n <namespace>`
- **Readiness Verification**: Probes pod ready condition and restart counts.
- **Rollback Verification**: Probes post-rollback pods to ensure error rates recover to 0.0.

---

## Configuration (`.carf.yml`)

```yaml
version: "1.0"
mode: "standalone"

target:
  runtime: "kubernetes"
  deployment: "order-service"
  namespace: "production"
  health_url: "http://order-service.production.svc.cluster.local/healthz"

rules:
  window_seconds: 300
  base_ceiling: 0.04
```

---

## RBAC Permissions

CARF requires a ServiceAccount with permissions to inspect and rollback deployments:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: carf-rollback-role
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "update", "patch"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
```
