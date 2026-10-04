#!/usr/bin/env bash
set -euo pipefail

TARGET_VERSION="${1:-v1}"
ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> [Docker Environment] Rolling back container to previous image version: $TARGET_VERSION"

# Recreate container with the target version image
APP_VERSION="$TARGET_VERSION" docker compose -f "$ENV_DIR/compose.yml" up -d --force-recreate sample-app

echo "==> Waiting for rolled-back container to stabilize..."
sleep 3

echo "==> Rollback to $TARGET_VERSION completed."
