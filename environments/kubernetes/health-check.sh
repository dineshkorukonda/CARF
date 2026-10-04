#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="carf-test"
DEPLOYMENT="sample-k8s-app"

echo "==> Inspecting Kubernetes deployment: $DEPLOYMENT in namespace $NAMESPACE"
AVAILABLE=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo "0")
REPLICAS=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

echo "Available replicas: $AVAILABLE / Desired replicas: $REPLICAS"

if [ "$AVAILABLE" -gt 0 ] && [ "$AVAILABLE" -eq "$REPLICAS" ]; then
  echo "✓ All pods ready and healthy"
  kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT"
  exit 0
else
  echo "✗ Deployment health check failed: $AVAILABLE/$REPLICAS replicas available"
  kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT"
  exit 1
fi
