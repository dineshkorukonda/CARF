param (
  [string]$Version = "v2"
)

$Namespace = "carf-test"
$Deployment = "sample-k8s-app"

Write-Host "==> [Flagger] Triggering canary deployment to version: $Version"

# Apply Canary resource
kubectl apply -f (Join-Path $PSScriptRoot "canary.yaml")

# Set image on deployment
kubectl set image "deployment/$Deployment" "app=carf-sample-app:$Version" -n $Namespace

Write-Host "==> Checking canary status..."
kubectl describe canary sample-app-canary -n $Namespace

Write-Host "[OK] Canary deployment triggered for version $Version"
