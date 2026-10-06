$ErrorActionPreference = "Stop"

Write-Host "==> Installing Argo Rollouts Controller and CRDs..."
kubectl create namespace argo-rollouts --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

Write-Host "==> Waiting for Argo Rollouts controller to become ready..."
kubectl rollout status deployment/argo-rollouts -n argo-rollouts --timeout=120s

Write-Host "[OK] Argo Rollouts controller installed and ready."
