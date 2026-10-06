$Namespace = "carf-test"
$Deployment = "sample-k8s-app"

Write-Host "==> [Flagger] Simulating canary failure scenario with broken image..."
kubectl set image "deployment/$Deployment" "app=carf-sample-app:broken" -n $Namespace

Write-Host "==> Flagger will detect failed health checks and automatically roll back traffic to stable primary."
Write-Host "==> Monitor progress with: kubectl get canary sample-app-canary -n $Namespace -w"
