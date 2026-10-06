# Linux systemd Runtime Adapter Guide

The systemd adapter manages native Linux service units, checks active unit states via `systemctl`, probes HTTP endpoints, and performs atomic git revision rollbacks and service restarts.

---

## Capabilities

- **Service Unit State Monitoring**: Queries `systemctl is-active <service>` and `systemctl show`.
- **Atomic Git Rollback**: Executes `git checkout <previousRevision>` in the service working directory.
- **Service Restart**: Executes `systemctl restart <service>` and verifies post-restart health.

---

## Configuration (`.carf.yml`)

```yaml
version: "1.0"
mode: "standalone"

target:
  runtime: "systemd"
  service: "my-service.service"
  working_directory: "/var/www/my-service"
  health_url: "http://localhost:8080/healthz"
  user_mode: false # set true for systemctl --user

rules:
  window_seconds: 240
  base_ceiling: 0.05
  startup_grace_seconds: 5
```

---

## Service Unit Definition (`/etc/systemd/system/my-service.service`)

```ini
[Unit]
Description=My Application Service
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/my-service
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5s
Environment=NODE_ENV=production PORT=8080

[Install]
WantedBy=multi-user.target
```
