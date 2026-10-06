# Docker Compose Runtime Adapter Guide

The Docker Compose adapter provides automated crash detection, HTTP healthcheck probing, and automated container rollback to previous image tags.

---

## Capabilities

- **Container Inspection**: Discovers running container state, exit codes, and restart counts via Docker daemon CLI.
- **Atomic Image Tag Rollback**: Re-deploys previous known-healthy container image tag upon soak breach.
- **Grace Window Protection**: Ignores initial restart metrics during container bootstrap.

---

## Configuration (`.carf.yml`)

```yaml
version: "1.0"
mode: "standalone"

target:
  runtime: "docker"
  container: "api-backend"
  compose_file: "docker-compose.prod.yml"
  health_url: "http://localhost:8080/health"

rules:
  window_seconds: 300
  base_ceiling: 0.05
  startup_grace_seconds: 10
```

---

## Compose Healthcheck Configuration

Ensure your `docker-compose.yml` specifies a container healthcheck:

```yaml
version: "3.8"
services:
  api-backend:
    image: myrepo/api:v1.2.4
    restart: unless-stopped
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
```
