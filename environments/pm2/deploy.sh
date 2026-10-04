#!/usr/bin/env bash
set -euo pipefail

TARGET_VERSION="${1:-v1}"
ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ENV_DIR/app/$TARGET_VERSION"
CURRENT_DIR="$ENV_DIR/current"

if [ ! -d "$APP_DIR" ]; then
  echo "Error: Version directory $APP_DIR does not exist!"
  echo "Available versions: v1, v2, broken"
  exit 1
fi

echo "==> Deploying PM2 sample app version: $TARGET_VERSION"
# Atomic symlink update
ln -sfn "$APP_DIR" "$CURRENT_DIR"

# Check if pm2 process exists
if pm2 describe sample-pm2-app > /dev/null 2>&1; then
  echo "==> Reloading sample-pm2-app in PM2..."
  pm2 reload sample-pm2-app --update-env
else
  echo "==> Starting sample-pm2-app in PM2..."
  cd "$ENV_DIR" && pm2 start ecosystem.config.cjs
fi

echo "==> Deployment of $TARGET_VERSION completed."
