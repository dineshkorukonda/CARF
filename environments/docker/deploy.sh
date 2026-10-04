#!/usr/bin/env bash
set -euo pipefail

TARGET_VERSION="${1:-v1}"
ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> [Docker Environment] Deploying version: $TARGET_VERSION"

# Build image for the target version
echo "==> Building Docker image carf-sample-app:$TARGET_VERSION..."
docker build \
  --build-arg VERSION="$TARGET_VERSION" \
  -t "carf-sample-app:$TARGET_VERSION" \
  -f "$ENV_DIR/Dockerfile" \
  "$ENV_DIR"

# Launch / recreate container with target image
echo "==> Running docker compose up for version: $TARGET_VERSION..."
APP_VERSION="$TARGET_VERSION" docker compose -f "$ENV_DIR/compose.yml" up -d --force-recreate sample-app

echo "==> Waiting for container to be ready..."
sleep 3

echo "==> Deployment of $TARGET_VERSION completed."
