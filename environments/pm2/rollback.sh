#!/usr/bin/env bash
set -euo pipefail

TARGET_VERSION="${1:-v1}"
ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Rolling back sample-pm2-app to: $TARGET_VERSION"
"$ENV_DIR/deploy.sh" "$TARGET_VERSION"
echo "==> Rollback to $TARGET_VERSION completed."
