# Environment D — Argo Rollouts Deployment Environment

This environment provides progressive canary delivery on top of Kubernetes using Argo Rollouts.

## Architecture

- **Controller**: Argo Rollouts controller (`argo-rollouts` namespace).
- **Resource**: `Rollout` (`argoproj.io/v1alpha1`) targeting `sample-argo-rollout` in `carf-test`.
- **Strategy**: Canary progression with weighted steps (`setWeight: 20`, pause, `setWeight: 50`, pause).
- **Analysis**: `AnalysisTemplate` (`carf-error-rate-analysis`) evaluating endpoint health probes.
- **Rollback Mechanism**: Native Argo Rollouts abort and undo (`kubectl argo rollouts abort` + `undo`).

## Native Workflow (Demonstrated Independently)

### 1. Install Controller
```bash
./install.sh
# or PowerShell:
.\install.ps1
```

### 2. Deploy Stable Version 1
```bash
./deploy.sh v1
# or PowerShell:
.\deploy.ps1 -Version v1
```

### 3. Progressive Rollout of Version 2
```bash
./deploy.sh v2
# or PowerShell:
.\deploy.ps1 -Version v2
```

### 4. Abort & Rollback (Native Argo Rollouts)
```bash
./abort.sh
# or PowerShell:
.\abort.ps1
```

### 5. Verify Stable Restored Phase
```bash
./health-check.sh
# or PowerShell:
.\health-check.ps1
```
