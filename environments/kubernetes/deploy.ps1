param (
  [string]$Version = "v1"
)

$EnvDir = $PSScriptRoot
$Manifest = Join-Path $EnvDir "deployment-$Version.yaml"

if (-not (Test-Path $Manifest)) {
  Write-Error "Error: Manifest $Manifest not found! Available: v1, v2, broken"
  exit 1
}

Write-Host "==> [Kubernetes Environment] Deploying version: $Version"

# Apply namespace and service
kubectl apply -f (Join-Path $EnvDir "namespace.yaml")
kubectl apply -f (Join-Path $EnvDir "service.yaml")

# Apply deployment
Write-Host "==> Applying deployment manifest: $Manifest"
kubectl apply -f $Manifest

Write-Host "==> Waiting for deployment rollout status (timeout 60s)..."
kubectl rollout status deployment/sample-k8s-app -n carf-test --timeout=60s
if ($LASTEXITCODE -eq 0) {
  Write-Host "[OK] Rollout completed successfully for version $Version"
} else {
  Write-Host "[FAIL] Rollout failed or timed out for version $Version"
  exit 1
}
