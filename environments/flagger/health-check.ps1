$Namespace = "carf-test"
$Canary = "sample-app-canary"

Write-Host "==> Inspecting Flagger Canary: $Canary in namespace $Namespace"
$phase = kubectl get canary $Canary -n $Namespace -o jsonpath='{.status.phase}' 2>$null
if (-not $phase) { $phase = "Unknown" }

Write-Host "Canary Phase: $phase"

if ($phase -eq "Succeeded" -or $phase -eq "Initialized") {
  Write-Host "[OK] Flagger Canary is healthy in phase: $phase"
  exit 0
} elseif ($phase -eq "Progressing") {
  Write-Host "[WARN] Flagger Canary is currently Progressing"
  exit 0
} elseif ($phase -eq "Failed") {
  Write-Host "[FAIL] Flagger Canary failed and automatically rolled back to primary"
  exit 1
} else {
  Write-Host "[FAIL] Flagger Canary is in unexpected phase: $phase"
  exit 1
}
