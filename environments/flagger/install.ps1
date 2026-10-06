$ErrorActionPreference = "Stop"

Write-Host "==> Installing Flagger CRDs and Controller..."
kubectl apply -f https://raw.githubusercontent.com/fluxcd/flagger/main/artifacts/flagger/crd.yaml

Write-Host "==> Deploying Flagger operator in carf-test namespace..."
kubectl apply -k "https://github.com/fluxcd/flagger//kustomize/kubernetes?ref=main"

Write-Host "[OK] Flagger CRDs and operator registered."
