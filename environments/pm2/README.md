# Environment A — PM2 Reference Environment

This environment provides a reproducible local PM2 deployment target for CARF adapter integration and verification.

## Architecture

- **Application**: Lightweight Node.js HTTP server.
  - `app/v1`: Initial stable version (`GET /health` -> `200 OK`, `version: "v1"`).
  - `app/v2`: Secondary healthy release (`GET /health` -> `200 OK`, `version: "v2"`).
  - `app/broken`: Intentionally broken release (`GET /health` -> `500 Error`, simulating runtime crash / database failure).
- **Process Manager**: PM2 daemon managing `sample-pm2-app` via `ecosystem.config.cjs`.
- **Release Layout**: `current/` pointer pointing to the active application release.

## Native Lifecycle Operations

### 1. Deploy Version 1
```bash
./deploy.sh v1
# or on Windows:
.\deploy.ps1 -Version v1
```

### 2. Verify Health
```bash
./health-check.sh
# or on Windows:
.\health-check.ps1
```

### 3. Deploy Version 2 (or Broken Version)
```bash
./deploy.sh broken
# or on Windows:
.\deploy.ps1 -Version broken
```

### 4. Rollback to Known-Good Version
```bash
./rollback.sh v1
# or on Windows:
.\rollback.ps1 -Version v1
```

### 5. Verify Restored Health
```bash
./health-check.sh
# or on Windows:
.\health-check.ps1
```
