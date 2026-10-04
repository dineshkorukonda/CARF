#!/usr/bin/env bash
set -euo pipefail

TARGET_VERSION="${1:-v2}"
NAMESPACE="carf-test"
DEPLOYMENT="sample-k8s-app"

echo "==> [Flagger] Triggering canary deployment to version: $TARGET_VERSION"

# Ensure Canary resource is applied
kubectl apply -f "$(dirname "${BASH_SOURCE[0]}")/canary.yaml"

# Update deployment image to trigger Flagger canary analysis
kubectl set image deployment/"$DEPLOYMENT" app="carf-sample-app:$TARGET_VERSION" -n "$NAMESPACE"

echo "==> Waiting for Flagger canary progression..."
kubectl describe canary sample-app-canary -n "$NAMESPACE" | grep -A 5 "Status:" || true

echo "✓ Canary deployment triggered for version $TARGET_VERSION"
