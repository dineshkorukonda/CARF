param (
  [string]$Version = "v1"
)

$EnvDir = $PSScriptRoot
$Manifest = Join-Path $EnvDir "rollout-$Version.yaml"

if (-not (Test-Path $Manifest)) {
  Write-Error "Error: Manifest $Manifest not found! Available: v1, v2, broken"
  exit 1
}

Write-Host "==> [Argo Rollouts] Deploying rollout version: $Version"

# Apply analysis template and rollout
kubectl apply -f (Join-Path $EnvDir "analysis-template.yaml")
kubectl apply -f $Manifest

Write-Host "==> Checking rollout status..."
kubectl get rollout sample-argo-rollout -n carf-test -o wide

Write-Host "[OK] Rollout command applied for version $Version"
