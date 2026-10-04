#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="carf-test"
CANARY="sample-app-canary"

echo "==> Inspecting Flagger Canary: $CANARY in namespace $NAMESPACE"
PHASE=$(kubectl get canary "$CANARY" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
echo "Canary Phase: $PHASE"

if [ "$PHASE" = "Succeeded" ] || [ "$PHASE" = "Initialized" ]; then
  echo "✓ Flagger Canary is healthy in phase: $PHASE"
  exit 0
elif [ "$PHASE" = "Progressing" ]; then
  echo "⚠ Flagger Canary is currently Progressing"
  exit 0
elif [ "$PHASE" = "Failed" ]; then
  echo "✗ Flagger Canary failed and automatically rolled back to primary"
  exit 1
else
  echo "✗ Flagger Canary is in unexpected phase: $PHASE"
  exit 1
fi
