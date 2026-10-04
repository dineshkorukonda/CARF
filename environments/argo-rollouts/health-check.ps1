$RolloutName = "sample-argo-rollout"
$Namespace = "carf-test"

Write-Host "==> Inspecting Argo Rollout: $RolloutName in namespace $Namespace"
$phase = kubectl get rollout $RolloutName -n $Namespace -o jsonpath='{.status.phase}' 2>$null
if (-not $phase) { $phase = "Unknown" }

Write-Host "Rollout Phase: $phase"

if ($phase -eq "Healthy") {
  Write-Host "[OK] Rollout is Healthy"
  exit 0
} elseif ($phase -eq "Paused") {
  Write-Host "[WARN] Rollout is Paused at step"
  exit 0
} else {
  Write-Host "[FAIL] Rollout is in unhealthy/unexpected phase: $phase"
  exit 1
}
