#!/usr/bin/env bash

# CARF Host Agent Installer
# Lightweight, secure background agent for host-colocated deployment monitoring.
# Zero database credentials. Communicates via scoped HTTPS install token.
# Standardized exclusively on PM2 process management.

set -euo pipefail

# ANSI color codes
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${BLUE}[carf-installer]${NC} $*"; }
success() { echo -e "${GREEN}[carf-installer] \xE2\x9C\x93${NC} $*"; }
warn() { echo -e "${YELLOW}[carf-installer] \xE2\x9A\xA0${NC} $*"; }
error() { echo -e "${RED}[carf-installer] \xE2\x9C\x97${NC} $*" >&2; }

CENTRAL_URL="${CARF_CENTRAL_API_URL:-https://carf.indevs.in}"
INSTALL_TOKEN="${CARF_INSTALL_TOKEN:-}"
AGENT_DIR="${CARF_AGENT_DIR:-${HOME:-/root}/.carf/agent}"
IS_UPDATE=0
IS_UNINSTALL=0
PM2_NAME="carf-agent"

print_usage() {
  cat <<HELP
CARF Host Agent Installer

Usage:
  curl -fsSL ${CENTRAL_URL}/install.sh | bash
  curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- [OPTIONS]

Options:
  --token=<token>, -t <token>         CARF scoped install token (optional; pairs immediately)
  --central-url=<url>, --api=<url>    Central CARF API URL (default: ${CENTRAL_URL})
  --update                            Update agent code to latest and restart PM2 daemon
  --uninstall                         Uninstall PM2 background service, remove agent files, notify API
  --help, -h                          Show this help message

Examples:
  # 1-line zero-token install:
  curl -fsSL ${CENTRAL_URL}/install.sh | bash

  # Install with dashboard token:
  curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- --token=carf_inst_0123...

  # Update or uninstall:
  curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- --update
  curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- --uninstall
HELP
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token=*)
      INSTALL_TOKEN="${1#*=}"
      shift
      ;;
    -t)
      if [[ -n "${2:-}" && ! "$2" =~ ^- ]]; then
        INSTALL_TOKEN="$2"
        shift 2
      else
        error "-t requires a token argument"
        exit 1
      fi
      ;;
    --central-url=*|--api=*)
      CENTRAL_URL="${1#*=}"
      shift
      ;;
    --update)
      IS_UPDATE=1
      shift
      ;;
    --uninstall)
      IS_UNINSTALL=1
      shift
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      warn "Unknown option: $1"
      shift
      ;;
  esac
done

# Strip trailing slash from CENTRAL_URL
CENTRAL_URL="${CENTRAL_URL%/}"

# -----------------------------------------------------------------------------
# Handle Uninstallation
# -----------------------------------------------------------------------------
if [[ "$IS_UNINSTALL" -eq 1 ]]; then
  info "Initiating CARF Agent uninstallation..."

  # Stop and remove PM2 service if registered
  if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
      info "Removing PM2 daemon process '$PM2_NAME'..."
      pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
      pm2 save >/dev/null 2>&1 || true
      success "PM2 process '$PM2_NAME' removed."
    fi
  fi

  # Notify central API if agent script and .env exist
  if [[ -f "$AGENT_DIR/agent.mjs" && -f "$AGENT_DIR/.env" ]]; then
    info "Notifying CARF central API of agent revocation..."
    (cd "$AGENT_DIR" && node agent.mjs --uninstall >/dev/null 2>&1) || true
  fi

  # Remove agent files
  if [[ -d "$AGENT_DIR" ]]; then
    rm -rf "$AGENT_DIR"
    success "Removed agent directory at $AGENT_DIR"
  fi

  success "CARF Host Agent successfully uninstalled."
  exit 0
fi

# -----------------------------------------------------------------------------
# Handle Update Mode
# -----------------------------------------------------------------------------
if [[ "$IS_UPDATE" -eq 1 ]]; then
  info "Updating CARF Host Agent..."
  if [[ ! -d "$AGENT_DIR" || ! -f "$AGENT_DIR/.env" ]]; then
    error "CARF Agent installation not found at $AGENT_DIR. Run a fresh install."
    exit 1
  fi

  # Read existing .env if not explicitly passed
  if [[ -z "$INSTALL_TOKEN" && -f "$AGENT_DIR/.env" ]]; then
    # shellcheck disable=SC1090
    source "$AGENT_DIR/.env" || true
    INSTALL_TOKEN="${CARF_INSTALL_TOKEN:-$INSTALL_TOKEN}"
    CENTRAL_URL="${CARF_CENTRAL_API_URL:-$CENTRAL_URL}"
  fi

  info "Downloading latest agent.mjs from ${CENTRAL_URL}/agent/agent.mjs..."
  curl -fsSL "${CENTRAL_URL}/agent/agent.mjs" -o "$AGENT_DIR/agent.mjs.tmp"
  mv "$AGENT_DIR/agent.mjs.tmp" "$AGENT_DIR/agent.mjs"
  chmod +x "$AGENT_DIR/agent.mjs"

  # Restart PM2 daemon if active
  if command -v pm2 >/dev/null 2>&1 && pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    info "Restarting PM2 process '$PM2_NAME'..."
    pm2 restart "$PM2_NAME" --update-env >/dev/null 2>&1
    success "PM2 daemon updated and restarted."
  else
    warn "No running PM2 process detected. Starting via PM2:"
    pm2 start "$AGENT_DIR/agent.mjs" --name "$PM2_NAME" --time >/dev/null 2>&1 || true
    pm2 save >/dev/null 2>&1 || true
  fi

  success "CARF Host Agent updated to latest version."
  exit 0
fi

# -----------------------------------------------------------------------------
# Install Preflight: Status notice
# -----------------------------------------------------------------------------
if [[ -z "$INSTALL_TOKEN" ]]; then
  info "Installing CARF Host Agent in 1-line zero-token mode."
  info "Agent will start in PM2 standby mode; pair with dashboard anytime."
else
  success "Using provided install token for host linking."
fi

info "Starting CARF Host Agent installation..."

# -----------------------------------------------------------------------------
# Check Node.js Runtime (>= 18)
# -----------------------------------------------------------------------------
info "Checking Node.js environment..."
if ! command -v node >/dev/null 2>&1; then
  warn "Node.js was not detected in PATH. Attempting to install Node.js..."
  if command -v apt-get >/dev/null 2>&1; then
    info "Detected apt-get. Installing Node.js LTS via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - || true
    apt-get install -y nodejs || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf module install -y nodejs:20 || true
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nodejs || true
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache nodejs npm || true
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  error "Node.js (>= 18) is required but could not be located or installed automatically."
  echo "Please install Node.js 18+ and rerun this installer."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  error "Node.js version $NODE_VERSION detected. CARF requires Node.js >= 18.0.0."
  exit 1
fi
success "Node.js v$NODE_VERSION detected."

# -----------------------------------------------------------------------------
# Check & Setup PM2 Process Manager
# -----------------------------------------------------------------------------
info "Checking PM2 process manager..."
if ! command -v pm2 >/dev/null 2>&1; then
  info "PM2 not found in PATH. Attempting to install PM2 globally via npm..."
  if command -v npm >/dev/null 2>&1; then
    npm install -g pm2 >/dev/null 2>&1 || sudo npm install -g pm2 >/dev/null 2>&1 || true
  fi
fi

if ! command -v pm2 >/dev/null 2>&1; then
  warn "PM2 could not be installed automatically."
  warn "You can install PM2 with: npm install -g pm2"
else
  success "PM2 process manager detected."
fi

# -----------------------------------------------------------------------------
# Directory Setup & Agent Download
# -----------------------------------------------------------------------------
info "Setting up agent directory at ${AGENT_DIR}..."
mkdir -p "$AGENT_DIR"

info "Downloading agent daemon from ${CENTRAL_URL}/agent/agent.mjs..."
curl -fsSL "${CENTRAL_URL}/agent/agent.mjs" -o "$AGENT_DIR/agent.mjs"
chmod +x "$AGENT_DIR/agent.mjs"

# -----------------------------------------------------------------------------
# Zero Database Credentials Environment
# -----------------------------------------------------------------------------
info "Writing environment configuration..."
cat <<EOF > "$AGENT_DIR/.env"
CARF_INSTALL_TOKEN=${INSTALL_TOKEN}
CARF_CENTRAL_API_URL=${CENTRAL_URL}
EOF

chmod 600 "$AGENT_DIR/.env"
success "Wrote isolated environment configuration (mode 0600)."

# -----------------------------------------------------------------------------
# Background Service Setup & Start via PM2
# -----------------------------------------------------------------------------
if command -v pm2 >/dev/null 2>&1; then
  info "Configuring PM2 process '$PM2_NAME'..."
  # Clean up existing instance if any
  pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true

  # Start daemon under PM2
  pm2 start "$AGENT_DIR/agent.mjs" --name "$PM2_NAME" --time >/dev/null 2>&1
  pm2 save >/dev/null 2>&1 || true
  success "Started '$PM2_NAME' under PM2 process manager."
else
  warn "PM2 is not active. Run agent in background manually:"
  echo "  node $AGENT_DIR/agent.mjs &"
fi

# -----------------------------------------------------------------------------
# Preflight Verification Probe
# -----------------------------------------------------------------------------
info "Running initial PM2 verification probe..."
node "$AGENT_DIR/agent.mjs" --verify || true

echo ""
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo -e "${GREEN}${BOLD}           CARF Host Agent Successfully Installed!              ${NC}"
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo -e " • Process Manager:  ${BOLD}PM2${NC}"
echo -e " • Agent Directory:  ${AGENT_DIR}"
echo -e " • Central API:      ${CENTRAL_URL}"
if [[ -n "$INSTALL_TOKEN" ]]; then
  echo -e " • Connection:       ${GREEN}Connected with install token${NC}"
else
  echo -e " • Connection:       ${YELLOW}Standby (ready to link)${NC}"
  echo -e ""
  echo -e " To link this server to your CARF account:"
  echo -e "   1. Open ${CENTRAL_URL}/dashboard/setup"
  echo -e "   2. Run: node ${AGENT_DIR}/agent.mjs --token=<your_token>"
fi
echo ""
echo -e " Useful commands:"
echo -e "   pm2 status $PM2_NAME     Check agent daemon status"
echo -e "   pm2 logs $PM2_NAME       Stream agent logs"
echo -e "   pm2 restart $PM2_NAME    Restart agent"
echo -e "   curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- --update       Update agent"
echo -e "   curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- --uninstall    Uninstall agent"
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo ""
