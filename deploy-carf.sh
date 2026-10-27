#!/usr/bin/env bash
# Rebuilds AND restarts both PM2 apps. Building dashboard alone left carf-core-api
# on the Capistrano verify path (releases/ + current), which is why Sahaay stayed unverified.
set -euo pipefail

# Non-interactive SSH sessions do not load Bun's shell-profile PATH setup.
if ! command -v bun >/dev/null 2>&1; then
  if [[ -x "$HOME/.bun/bin/bun" ]]; then
    export PATH="$HOME/.bun/bin:$PATH"
  else
    echo "ERROR: Bun was not found. Install it or add it to PATH before deploying." >&2
    exit 1
  fi
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

CORE_APP="${CARF_CORE_PM2_NAME:-carf-core-api}"
DASH_APP="${CARF_DASHBOARD_PM2_NAME:-carf-dashboard}"

echo "==> Pulling latest main..."
git fetch origin main
git checkout main
git stash push -m "deploy-carf local lockfiles" -- core-api/package-lock.json dashboard/package-lock.json >/dev/null 2>&1 || true
git pull --ff-only origin main

echo "==> HEAD is $(git log -1 --oneline)"

echo "==> Installing core-api dependencies..."
cd "$ROOT/core-api"
bun install
echo "==> Regenerating core-api Prisma client..."
bunx prisma generate
echo "==> Building core-api..."
bun run build

echo "==> Installing dashboard dependencies..."
cd "$ROOT/dashboard"
bun install
echo "==> Regenerating dashboard Prisma client..."
bunx prisma generate
echo "==> Building dashboard..."
bun run build

echo "==> Applying canonical database migrations..."
cd "$ROOT/core-api"
bun run db:migrate:deploy

echo "==> Restarting $CORE_APP and $DASH_APP..."
pm2 restart "$CORE_APP" --update-env
pm2 restart "$DASH_APP" --update-env
pm2 save

echo "==> Confirm these cwd paths are $ROOT (or $ROOT/core-api and $ROOT/dashboard):"
pm2 show "$CORE_APP" | grep -E "status|exec cwd|script path|unstable restarts" || true
pm2 show "$DASH_APP" | grep -E "status|exec cwd|script path|unstable restarts" || true

echo "==> Done."
echo "    If Sahaay still sees releases/current checks, $CORE_APP did not load this build."
echo "    Fix: pm2 delete $CORE_APP && cd $ROOT/core-api && pm2 start dist/src/index.js --name $CORE_APP && pm2 save"
