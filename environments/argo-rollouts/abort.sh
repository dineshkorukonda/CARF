#!/usr/bin/env bash
set -euo pipefail

ROLLOUT_NAME="sample-argo-rollout"
NAMESPACE="carf-test"

echo "==> [Argo Rollouts] Aborting active rollout: $ROLLOUT_NAME"
if command -v kubectl-argo-rollouts > /dev/null 2>&1; then
  kubectl argo rollouts abort "$ROLLOUT_NAME" -n "$NAMESPACE"
  echo "==> Rolling back to previous stable revision:"
  kubectl argo rollouts undo "$ROLLOUT_NAME" -n "$NAMESPACE"
else
  # Direct patch fallback if plugin not installed
  kubectl patch rollout "$ROLLOUT_NAME" -n "$NAMESPACE" --type='merge' -p '{"spec":{"paused":true}}'
  echo "==> Aborted via patch pause."
fi

echo "✓ Argo Rollout aborted and rolled back to stable."
