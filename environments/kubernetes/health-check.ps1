$Namespace = "carf-test"
$Deployment = "sample-k8s-app"

Write-Host "==> Inspecting Kubernetes deployment: $Deployment in namespace $Namespace"
$available = kubectl get deployment $Deployment -n $Namespace -o jsonpath='{.status.availableReplicas}' 2>$null
$replicas = kubectl get deployment $Deployment -n $Namespace -o jsonpath='{.spec.replicas}' 2>$null

if (-not $available) { $available = "0" }
if (-not $replicas) { $replicas = "0" }

Write-Host "Available replicas: $available / Desired replicas: $replicas"

if ([int]$available -gt 0 -and [int]$available -ge [int]$replicas) {
  Write-Host "[OK] All pods ready and healthy"
  kubectl get pods -n $Namespace -l app=$Deployment
  exit 0
} else {
  Write-Host "[FAIL] Deployment health check failed: $available/$replicas replicas available"
  kubectl get pods -n $Namespace -l app=$Deployment
  exit 1
}
