chmod +x "$AGENT_DIR/agent.mjs"

# Write isolated .env containing ONLY CARF_INSTALL_TOKEN and CARF_CENTRAL_API_URL
# Zero external database strings or credentials are ever stored locally.
cat <<EOF > "$AGENT_DIR/.env"
CARF_INSTALL_TOKEN=${INSTALL_TOKEN}
CARF_CENTRAL_API_URL=${CENTRAL_URL}
EOF

chmod 600 "$AGENT_DIR/.env"