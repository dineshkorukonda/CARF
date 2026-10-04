#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="carf-sample-docker-app"
HEALTH_URL="http://localhost:8080/health"

echo "==> Inspecting Docker container state:"
if ! docker inspect "$CONTAINER_NAME" > /dev/null 2>&1; then
  echo "✗ Container $CONTAINER_NAME does not exist!"
  exit 1
fi

STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER_NAME")
echo "Container Status: $STATUS"

if [ "$STATUS" != "running" ]; then
  echo "✗ Container is not running (status: $STATUS)"
  exit 1
fi

echo "==> HTTP Probe: $HEALTH_URL"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
echo "HTTP Status Code: $HTTP_CODE"

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✓ Docker health check passed (HTTP 200)"
  curl -s "$HEALTH_URL"
  echo ""
  exit 0
else
  echo "✗ Docker health check failed (HTTP $HTTP_CODE)"
  exit 1
fi
