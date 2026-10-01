#!/usr/bin/env bash

# CARF Host Agent Installer
# Lightweight, secure background agent for host-colocated deployment monitoring.
# Zero database credentials. Communicates via scoped HTTPS install token.

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
AGENT_DIR="${HOME:-/root}/.carf/agent"
PROCESS_MANAGER="auto"
IS_UPDATE=0
IS_UNINSTALL=0

print_usage() {
  cat <<HELP
CARF Host Agent Installer

Usage:
  curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- [OPTIONS]

Options:
  --token=<token>, -t <token>     CARF scoped install token (required for initial install)
  --api=<url>, -a <url>           Central CARF API URL (default: ${CENTRAL_URL})
  --pm2                           Force PM2 process manager
  --systemd                       Force systemd service manager
  --update                        Update agent code to latest and restart background daemon
  --uninstall                     Uninstall background service, remove agent files, notify API
  --help, -h                      Show this help message

Examples:
  curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- --token=carf_inst_0123...
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
      INSTALL_TOKEN="$2"
      shift 2
      ;;
    --api=*|--url=*)
      CENTRAL_URL="${1#*=}"
      shift
      ;;
    -a)
      CENTRAL_URL="$2"
      shift 2
      ;;
    --pm2)
      PROCESS_MANAGER="pm2"
      shift
      ;;
    --systemd)
      PROCESS_MANAGER="systemd"
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
    if pm2 describe carf-agent >/dev/null 2>&1; then
      info "Removing PM2 daemon process 'carf-agent'..."
      pm2 delete carf-agent >/dev/null 2>&1 || true
      pm2 save >/dev/null 2>&1 || true
      success "PM2 process 'carf-agent' removed."
    fi
  fi

  # Stop and remove systemd service if registered
  if command -v systemctl >/dev/null 2>&1; then
    if [[ -f "/etc/systemd/system/carf-agent.service" ]]; then
      info "Removing system-wide systemd service..."
      if [[ "$EUID" -eq 0 ]]; then
        systemctl disable --now carf-agent.service >/dev/null 2>&1 || true
        rm -f /etc/systemd/system/carf-agent.service
        systemctl daemon-reload >/dev/null 2>&1 || true
      else
        sudo systemctl disable --now carf-agent.service >/dev/null 2>&1 || true
        sudo rm -f /etc/systemd/system/carf-agent.service
        sudo systemctl daemon-reload >/dev/null 2>&1 || true
      fi
      success "systemd service removed."
    fi

    if [[ -f "${HOME:-}/.config/systemd/user/carf-agent.service" ]]; then
      info "Removing user systemd service..."
      systemctl --user disable --now carf-agent.service >/dev/null 2>&1 || true
      rm -f "${HOME:-}/.config/systemd/user/carf-agent.service"
      systemctl --user daemon-reload >/dev/null 2>&1 || true
      success "User systemd service removed."
    fi
  fi

  # Notify central API if agent script and .env exist
  if [[ -f "$AGENT_DIR/agent.mjs" && -f "$AGENT_DIR/.env" ]]; then
    info "Notifying CARF central API of agent revocation..."
    node "$AGENT_DIR/agent.mjs" --uninstall >/dev/null 2>&1 || true
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
    error "CARF Agent installation not found at $AGENT_DIR. Run a fresh install with --token=<token>."
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
  if command -v pm2 >/dev/null 2>&1 && pm2 describe carf-agent >/dev/null 2>&1; then
    info "Restarting PM2 process 'carf-agent'..."
    pm2 restart carf-agent --update-env >/dev/null 2>&1
    success "PM2 daemon updated and restarted."
  elif command -v systemctl >/dev/null 2>&1 && (systemctl is-active carf-agent.service >/dev/null 2>&1 || systemctl --user is-active carf-agent.service >/dev/null 2>&1); then
    info "Restarting systemd service 'carf-agent'..."
    if [[ "$EUID" -eq 0 ]]; then
      systemctl restart carf-agent.service
    else
      systemctl --user restart carf-agent.service 2>/dev/null || sudo systemctl restart carf-agent.service
    fi
    success "systemd service updated and restarted."
  else
    warn "No running PM2 or systemd service detected. Run verification:"
    node "$AGENT_DIR/agent.mjs" --verify
  fi

  success "CARF Host Agent updated to latest version."
  exit 0
fi

# -----------------------------------------------------------------------------
# Preflight: Validate Token
# -----------------------------------------------------------------------------
if [[ -z "$INSTALL_TOKEN" ]]; then
  error "CARF_INSTALL_TOKEN is required."
  echo ""
  echo "Usage: curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- --token=<your_install_token>"
  echo ""
  echo "Generate your install token from your CARF dashboard at: ${CENTRAL_URL}/dashboard/setup"
  exit 1
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
# Detect or Configure Process Manager (PM2 / systemd)
# -----------------------------------------------------------------------------
info "Detecting process manager (PM2 or systemd)..."
HAS_PM2=0
HAS_SYSTEMD=0

if command -v pm2 >/dev/null 2>&1; then
  HAS_PM2=1
fi

if command -v systemctl >/dev/null 2>&1; then
  HAS_SYSTEMD=1
fi

# Auto-selection logic
if [[ "$PROCESS_MANAGER" == "auto" ]]; then
  if [[ "$HAS_PM2" -eq 1 ]]; then
    PROCESS_MANAGER="pm2"
  elif [[ "$HAS_SYSTEMD" -eq 1 ]]; then
    # If PM2 is not present, check if npm is available to install PM2, or fallback to systemd
    if command -v npm >/dev/null 2>&1; then
      info "Installing PM2 globally via npm..."
      if npm install -g pm2 >/dev/null 2>&1; then
        HAS_PM2=1
        PROCESS_MANAGER="pm2"
      else
        PROCESS_MANAGER="systemd"
      fi
    else
      PROCESS_MANAGER="systemd"
    fi
  else
    if command -v npm >/dev/null 2>&1; then
      info "Installing PM2 globally via npm..."
      npm install -g pm2 >/dev/null 2>&1 || true
      if command -v pm2 >/dev/null 2>&1; then
        PROCESS_MANAGER="pm2"
      fi
    fi
  fi
fi

if [[ "$PROCESS_MANAGER" != "pm2" && "$PROCESS_MANAGER" != "systemd" ]]; then
  PROCESS_MANAGER="systemd"
fi

info "Selected process manager: ${BOLD}${PROCESS_MANAGER}${NC}"

# -----------------------------------------------------------------------------
# Directory Setup & Agent Download
# -----------------------------------------------------------------------------
info "Setting up agent directory at ${AGENT_DIR}..."
mkdir -p "$AGENT_DIR"

info "Downloading agent daemon from ${CENTRAL_URL}/agent/agent.mjs..."
curl -fsSL "${CENTRAL_URL}/agent/agent.mjs" -o "$AGENT_DIR/agent.mjs"
chmod +x "$AGENT_DIR/agent.mjs"

# Write isolated .env containing ONLY CARF_INSTALL_TOKEN and CARF_CENTRAL_API_URL
# Zero external database strings or credentials are ever stored locally.
cat <<EOF > "$AGENT_DIR/.env"
CARF_INSTALL_TOKEN=${INSTALL_TOKEN}
CARF_CENTRAL_API_URL=${CENTRAL_URL}
EOF

chmod 600 "$AGENT_DIR/.env"
success "Wrote isolated environment configuration (mode 0600)."

# -----------------------------------------------------------------------------
# Background Service Setup & Start
# -----------------------------------------------------------------------------
NODE_BIN=$(command -v node)

if [[ "$PROCESS_MANAGER" == "pm2" ]]; then
  info "Configuring PM2 process 'carf-agent'..."
  # Clean up existing instance if any
  pm2 delete carf-agent >/dev/null 2>&1 || true

  # Start daemon under PM2
  pm2 start "$AGENT_DIR/agent.mjs" --name carf-agent --time >/dev/null 2>&1
  pm2 save >/dev/null 2>&1 || true
  success "Started 'carf-agent' under PM2 process manager."
elif [[ "$PROCESS_MANAGER" == "systemd" ]]; then
  info "Configuring systemd service 'carf-agent'..."

  SERVICE_CONTENT="[Unit]
Description=CARF Host Agent - Change-Aware Rollback Framework
After=network.target

[Service]
Type=simple
User=${USER:-root}
WorkingDirectory=${AGENT_DIR}
ExecStart=${NODE_BIN} ${AGENT_DIR}/agent.mjs
Restart=always
RestartSec=10
EnvironmentFile=${AGENT_DIR}/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target"

  if [[ "$EUID" -eq 0 ]]; then
    echo "$SERVICE_CONTENT" > /etc/systemd/system/carf-agent.service
    systemctl daemon-reload
    systemctl enable --now carf-agent.service
    success "Enabled and started system-wide systemd service: carf-agent.service"
  else
    USER_SYSTEMD_DIR="${HOME:-}/.config/systemd/user"
    mkdir -p "$USER_SYSTEMD_DIR"
    echo "$SERVICE_CONTENT" > "$USER_SYSTEMD_DIR/carf-agent.service"
    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user enable --now carf-agent.service 2>/dev/null || true
    success "Enabled and started user systemd service: carf-agent.service"
  fi
fi

# -----------------------------------------------------------------------------
# Preflight Verification Probe
# -----------------------------------------------------------------------------
info "Running initial host verification probe..."
node "$AGENT_DIR/agent.mjs" --verify || true

echo ""
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo -e "${GREEN}${BOLD}           CARF Host Agent Successfully Installed!              ${NC}"
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo -e " \xE2\x80\xA2 Process Manager:  ${BOLD}${PROCESS_MANAGER}${NC}"
echo -e " \xE2\x80\xA2 Agent Directory:  ${AGENT_DIR}"
echo -e " \xE2\x80\xA2 Central API:      ${CENTRAL_URL}"
echo -e " \xE2\x80\xA2 Background Status: Running (active heartbeat every 60s)"
echo ""
echo -e " Useful commands:"
if [[ "$PROCESS_MANAGER" == "pm2" ]]; then
  echo -e "   pm2 status carf-agent     Check agent status"
  echo -e "   pm2 logs carf-agent       Stream agent logs"
  echo -e "   pm2 restart carf-agent    Restart agent"
else
  echo -e "   systemctl status carf-agent   Check service status"
  echo -e "   journalctl -u carf-agent -f   Stream service logs"
fi
echo -e "   curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- --update       Update agent"
echo -e "   curl -fsSL ${CENTRAL_URL}/install.sh | bash -s -- --uninstall    Uninstall agent"
echo -e "${GREEN}${BOLD}================================================================${NC}"
echo ""
