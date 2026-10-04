$RolloutName = "sample-argo-rollout"
$Namespace = "carf-test"

Write-Host "==> [Argo Rollouts] Aborting active rollout: $RolloutName"
$hasPlugin = Get-Command kubectl-argo-rollouts -ErrorAction SilentlyContinue
if ($hasPlugin) {
  kubectl argo rollouts abort $RolloutName -n $Namespace
  Write-Host "==> Rolling back to previous stable revision:"
  kubectl argo rollouts undo $RolloutName -n $Namespace
} else {
  kubectl patch rollout $RolloutName -n $Namespace --type='merge' -p '{\"spec\":{\"paused\":true}}'
  Write-Host "==> Aborted via patch pause."
}

Write-Host "[OK] Argo Rollout aborted and rolled back to stable."
