#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="carf-test"
DEPLOYMENT="sample-k8s-app"

echo "==> [Flagger] Simulating canary failure scenario with broken image..."
kubectl set image deployment/"$DEPLOYMENT" app="carf-sample-app:broken" -n "$NAMESPACE"

echo "==> Flagger will detect failed health checks and automatically roll back traffic to stable primary."
echo "==> Monitor progress with: kubectl get canary sample-app-canary -n $NAMESPACE -w"
