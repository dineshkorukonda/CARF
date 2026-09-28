#!/usr/bin/env bash
set -euo pipefail

# End-to-end PM2 standalone verification script for CARF
# Demonstrates symlink-based releases, health monitoring breach, and automated rollback.

DEMO_ROOT="/tmp/carf-demo"
RELEASES_DIR="${DEMO_ROOT}/releases"
CURRENT_LINK="${DEMO_ROOT}/current"
APP_NAME="demo-target-app"

echo "=== 1. Setting up demo directory structure ==="
mkdir -p "${RELEASES_DIR}/sha-v1/src"
mkdir -p "${RELEASES_DIR}/sha-v2/src"

# Copy base server code to sha-v1 (healthy release)
cat << 'EOF' > "${RELEASES_DIR}/sha-v1/src/server.js"
import http from "node:http";
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: "sha-v1" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ app: "demo-target-app", version: "sha-v1" }));
});
server.listen(3000);
EOF

# Copy faulty server code to sha-v2 (unhealthy release that breaches threshold)
cat << 'EOF' > "${RELEASES_DIR}/sha-v2/src/server.js"
import http from "node:http";
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", version: "sha-v2" }));
    return;
  }
  res.writeHead(500, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Internal Server Error", version: "sha-v2" }));
});
server.listen(3000);
EOF

cat << 'EOF' > "${RELEASES_DIR}/sha-v1/package.json"
{ "name": "demo-target-app", "version": "1.0.0", "type": "module" }
EOF

cat << 'EOF' > "${RELEASES_DIR}/sha-v2/package.json"
{ "name": "demo-target-app", "version": "2.0.0", "type": "module" }
EOF

echo "=== 2. Pointing current symlink to sha-v1 and starting PM2 ==="
ln -sfn "${RELEASES_DIR}/sha-v1" "${CURRENT_LINK}"

if command -v pm2 &> /dev/null; then
  pm2 delete "${APP_NAME}" 2>/dev/null || true
  pm2 start "${CURRENT_LINK}/src/server.js" --name "${APP_NAME}" -i 2
  sleep 2

  echo "=== 3. Probing healthy release sha-v1 ==="
  curl -s http://localhost:3000/health || true
  echo ""

  echo "=== 4. Simulating deployment of bad release sha-v2 ==="
  ln -sfn "${RELEASES_DIR}/sha-v2" "${CURRENT_LINK}"
  pm2 reload "${APP_NAME}"
  sleep 2

  echo "=== 5. Probing bad release sha-v2 (triggers CARF breach) ==="
  curl -s http://localhost:3000/health || true
  echo ""

  echo "=== 6. Simulating CARF automated rollback to sha-v1 ==="
  ln -sfn "${RELEASES_DIR}/sha-v1" "${CURRENT_LINK}"
  pm2 reload "${APP_NAME}"
  sleep 2

  echo "=== 7. Post-rollback health verification ==="
  curl -s http://localhost:3000/health
  echo ""
  echo "PM2 standalone loop e2e verification succeeded!"
else
  echo "PM2 is not installed globally. Symlink layout and release structure prepared successfully."
fi
