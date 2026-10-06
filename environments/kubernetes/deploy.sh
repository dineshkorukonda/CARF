#!/usr/bin/env bash
set -euo pipefail

TARGET_VERSION="${1:-v1}"
ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$ENV_DIR/deployment-$TARGET_VERSION.yaml"

if [ ! -f "$MANIFEST" ]; then
  echo "Error: Manifest $MANIFEST not found! Available versions: v1, v2, broken"
  exit 1
fi

echo "==> [Kubernetes Environment] Deploying version: $TARGET_VERSION"

# Ensure namespace exists
kubectl apply -f "$ENV_DIR/namespace.yaml"

# Ensure service exists
kubectl apply -f "$ENV_DIR/service.yaml"

# Apply version deployment
echo "==> Applying deployment manifest: $MANIFEST"
kubectl apply -f "$MANIFEST"

echo "==> Waiting for deployment rollout status (timeout 60s)..."
if kubectl rollout status deployment/sample-k8s-app -n carf-test --timeout=60s; then
  echo "✓ Rollout completed successfully for version $TARGET_VERSION"
else
  echo "✗ Rollout failed or timed out for version $TARGET_VERSION"
  exit 1
fi
