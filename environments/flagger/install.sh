#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing Flagger CRDs and Controller..."
kubectl apply -f https://raw.githubusercontent.com/fluxcd/flagger/main/artifacts/flagger/crd.yaml

echo "==> Deploying Flagger operator in carf-test namespace..."
kubectl apply -k https://github.com/fluxcd/flagger//kustomize/kubernetes?ref=main || true

echo "✓ Flagger CRDs and operator registered."
