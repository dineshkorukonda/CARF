# Environment C — Kubernetes Deployment Environment

This environment provides a local reproducible Kubernetes workload for CARF adapter integration and verification.

## Architecture

- **Namespace**: `carf-test` (isolated namespace dedicated to CARF testing).
- **Workload**: `sample-k8s-app` Deployment with rolling update strategy, 2 replicas, and HTTP liveness & readiness probes on port 8080 (`/health`).
- **Service**: `sample-k8s-app-svc` exposing port 8080 internally.
- **Rollback Mechanism**: Native Kubernetes deployment history rollback (`kubectl rollout undo deployment/sample-k8s-app -n carf-test`).

## Native Workflow (Demonstrated Independently)

### 1. Deploy Version 1
```bash
./deploy.sh v1
# or PowerShell:
.\deploy.ps1 -Version v1
```

### 2. Verify Health of Version 1
```bash
./health-check.sh
# or PowerShell:
.\health-check.ps1
```

### 3. Deploy Version 2 (or Broken Version)
```bash
./deploy.sh broken
# or PowerShell:
.\deploy.ps1 -Version broken
```
*Readiness probes fail on broken version, halting rolling update progression and preventing routing to broken pods.*

### 4. Rollback to Known-Good Version
```bash
./rollback.sh
# or PowerShell:
.\rollback.ps1
```

### 5. Verify Restored Health
```bash
./health-check.sh
# or PowerShell:
.\health-check.ps1
```
