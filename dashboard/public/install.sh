#!/usr/bin/env bash
# CARF standalone host agent installer.
# Usage:
#   curl -fsSL https://carf.indevs.in/install.sh | bash -s -- --token=<install_token>
#   curl -fsSL https://carf.indevs.in/install.sh | bash -s -- --uninstall
set -euo pipefail

CENTRAL_URL="${CARF_CENTRAL_API_URL:-https://carf.indevs.in}"
INSTALL_TOKEN=""
UNINSTALL=0
AGENT_DIR="${CARF_AGENT_DIR:-${HOME}/.carf/agent}"
PM2_NAME="carf-agent"

usage() {
  cat <<'USAGE'
CARF standalone agent installer

  --token=TOKEN     Install token from the dashboard repo-linking wizard
  --central-url=URL Central dashboard origin (default: https://carf.indevs.in)
  --uninstall       Stop the PM2 process and remove ~/.carf/agent
  --help            Show this help
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --token=*) INSTALL_TOKEN="${arg#--token=}" ;;
    --central-url=*) CENTRAL_URL="${arg#--central-url=}" ;;
    --uninstall) UNINSTALL=1 ;;
    --help|-h) usage; exit 0 ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

CENTRAL_URL="${CENTRAL_URL%/}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' not found on PATH." >&2
    exit 1
  fi
}

uninstall_agent() {
  if command -v pm2 >/dev/null 2>&1; then
    pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
    pm2 save >/dev/null 2>&1 || true
  fi
  if [ -x "$AGENT_DIR/agent.mjs" ] && [ -n "${CARF_INSTALL_TOKEN:-}" ] || [ -f "$AGENT_DIR/.env" ]; then
    # Best-effort notify central API; agent --uninstall never fails the local cleanup.
    (cd "$AGENT_DIR" && node agent.mjs --uninstall >/dev/null 2>&1) || true
  fi
  rm -rf "$AGENT_DIR"
  echo "CARF agent removed from ${AGENT_DIR}."
  exit 0
}

if [ "$UNINSTALL" -eq 1 ]; then
  uninstall_agent
fi

if [ -z "$INSTALL_TOKEN" ]; then
  echo "Error: --token=<install_token> is required." >&2
  usage >&2
  exit 1
fi

require_cmd curl
require_cmd node
require_cmd pm2

mkdir -p "$AGENT_DIR"
curl -fsSL "${CENTRAL_URL}/agent/agent.mjs" -o "$AGENT_DIR/agent.mjs"
chmod +x "$AGENT_DIR/agent.mjs"

# Write isolated .env containing ONLY CARF_INSTALL_TOKEN and CARF_CENTRAL_API_URL
# Zero external database strings or credentials are ever stored locally.
cat <<EOF > "$AGENT_DIR/.env"
CARF_INSTALL_TOKEN=${INSTALL_TOKEN}
CARF_CENTRAL_API_URL=${CENTRAL_URL}
EOF

chmod 600 "$AGENT_DIR/.env"

pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
pm2 start "$AGENT_DIR/agent.mjs" --name "$PM2_NAME" --interpreter node
pm2 save >/dev/null 2>&1 || true

echo "CARF agent installed."
echo "  dir:     ${AGENT_DIR}"
echo "  process: pm2 show ${PM2_NAME}"
echo "  verify:  node ${AGENT_DIR}/agent.mjs --verify"
echo "  remove:  curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- --uninstall"
