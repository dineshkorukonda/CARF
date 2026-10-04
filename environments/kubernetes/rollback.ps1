$ErrorActionPreference = "Stop"

Write-Host "==> [Kubernetes Environment] Executing native deployment rollback: kubectl rollout undo"
kubectl rollout undo deployment/sample-k8s-app -n carf-test

Write-Host "==> Waiting for rollback rollout status (timeout 60s)..."
kubectl rollout status deployment/sample-k8s-app -n carf-test --timeout=60s

if ($LASTEXITCODE -eq 0) {
  Write-Host "[OK] Rollback completed and verified."
} else {
  Write-Host "[FAIL] Rollback failed or timed out."
  exit 1
}
