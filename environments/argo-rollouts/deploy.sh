#!/usr/bin/env bash
set -euo pipefail

TARGET_VERSION="${1:-v1}"
ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$ENV_DIR/rollout-$TARGET_VERSION.yaml"

if [ ! -f "$MANIFEST" ]; then
  echo "Error: Manifest $MANIFEST not found! Available versions: v1, v2, broken"
  exit 1
fi

echo "==> [Argo Rollouts] Deploying rollout version: $TARGET_VERSION"

# Ensure AnalysisTemplate is registered
kubectl apply -f "$ENV_DIR/analysis-template.yaml"

# Apply Rollout manifest
kubectl apply -f "$MANIFEST"

echo "==> Watching rollout progress..."
if command -v kubectl-argo-rollouts > /dev/null 2>&1; then
  kubectl argo rollouts status sample-argo-rollout -n carf-test --timeout=60s
else
  kubectl get rollout sample-argo-rollout -n carf-test -o wide
fi

echo "✓ Rollout command applied for version $TARGET_VERSION"
