# Environment E — Flagger Deployment Environment

This environment provides progressive canary delivery on Kubernetes using Flagger.

## Architecture

- **Controller**: Flagger operator running in Kubernetes cluster.
- **Resource**: `Canary` (`flagger.app/v1beta1`) targeting `sample-k8s-app` in `carf-test`.
- **Target Workload**: Kubernetes Deployment `sample-k8s-app`.
- **Canary Promotion**: Traffic shifted progressively in 10% steps up to 50% max weight while monitoring success rate metrics.
- **Automatic Rollback**: Flagger automatically aborts and rolls back routing to the primary (stable) workload if error rate thresholds are breached.

## Native Workflow (Demonstrated Independently)

### 1. Install Flagger
```bash
./install.sh
# or PowerShell:
.\install.ps1
```

### 2. Trigger Canary Deployment (Version 2)
```bash
./deploy.sh v2
# or PowerShell:
.\deploy.ps1 -Version v2
```

### 3. Observe Canary Status
```bash
./health-check.sh
# or PowerShell:
.\health-check.ps1
```

### 4. Simulate Failure Scenario
```bash
./trigger-failure.sh
# or PowerShell:
.\trigger-failure.ps1
```
*Flagger detects failed health checks, halts progression, shifts 100% traffic back to primary, and scales canary to 0.*

### 5. Verify Rollback & Recovery
```bash
./health-check.sh
```
