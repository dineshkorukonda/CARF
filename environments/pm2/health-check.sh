#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3301}"
HEALTH_URL="http://localhost:${PORT}/health"

echo "==> PM2 Process Check:"
pm2 jlist | grep -q "sample-pm2-app" && echo "✓ Process found in PM2" || (echo "✗ Process not found in PM2"; exit 1)

echo "==> HTTP Probe: $HEALTH_URL"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
echo "HTTP Status Code: $HTTP_CODE"

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✓ Health check passed (HTTP 200)"
  curl -s "$HEALTH_URL"
  echo ""
  exit 0
else
  echo "✗ Health check failed (HTTP $HTTP_CODE)"
  exit 1
fi
