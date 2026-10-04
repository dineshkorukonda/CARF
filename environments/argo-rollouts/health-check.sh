#!/usr/bin/env bash
set -euo pipefail

ROLLOUT_NAME="sample-argo-rollout"
NAMESPACE="carf-test"

echo "==> Inspecting Argo Rollout: $ROLLOUT_NAME in namespace $NAMESPACE"
PHASE=$(kubectl get rollout "$ROLLOUT_NAME" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
echo "Rollout Phase: $PHASE"

if [ "$PHASE" = "Healthy" ]; then
  echo "✓ Rollout is Healthy"
  exit 0
elif [ "$PHASE" = "Paused" ]; then
  echo "⚠ Rollout is Paused at step"
  exit 0
else
  echo "✗ Rollout is in unhealthy/unexpected phase: $PHASE"
  exit 1
fi
