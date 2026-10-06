#!/usr/bin/env bash
set -euo pipefail

echo "==> [Kubernetes Environment] Executing native deployment rollback: kubectl rollout undo"
kubectl rollout undo deployment/sample-k8s-app -n carf-test

echo "==> Waiting for rollback rollout status (timeout 60s)..."
kubectl rollout status deployment/sample-k8s-app -n carf-test --timeout=60s

echo "✓ Rollback completed and verified."
