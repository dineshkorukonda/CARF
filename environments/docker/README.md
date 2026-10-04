# Environment B — Docker Deployment Environment

This environment provides a reproducible container deployment environment using Docker and Docker Compose.

## Architecture

- **Application**: Lightweight Node.js HTTP server containerized with Alpine base.
  - `app/v1`: Stable initial release (`GET /health` -> `200 OK`, `version: "v1"`).
  - `app/v2`: Healthy secondary release (`GET /health` -> `200 OK`, `version: "v2"`).
  - `app/broken`: Intentionally broken release (`GET /health` -> `500 Error`, simulating runtime crash).
- **Orchestration**: `compose.yml` declaring `sample-app` container, port `8080`, and container healthcheck.
- **Rollback Mechanism**: Image tag re-creation (`docker compose up -d --force-recreate sample-app`).

## Native Workflow (Demonstrated Independently)

### 1. Deploy Version 1
```bash
./deploy.sh v1
# or PowerShell:
.\deploy.ps1 -Version v1
```

### 2. Verify Health of Version 1
```bash
./health-check.sh
# or PowerShell:
.\health-check.ps1
```

### 3. Deploy Version 2 (or Broken Version)
```bash
./deploy.sh broken
# or PowerShell:
.\deploy.ps1 -Version broken
```

### 4. Detect Unhealthy State
```bash
./health-check.sh
# Exits with failure code and reports HTTP 500
```

### 5. Rollback to Version 1
```bash
./rollback.sh v1
# or PowerShell:
.\rollback.ps1 -Version v1
```

### 6. Verify Restored Health of Version 1
```bash
./health-check.sh
# Exits with success (HTTP 200, version: "v1")
```
