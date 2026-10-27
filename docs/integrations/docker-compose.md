# Docker Compose runtime

Docker health checks, versioned Compose deployment, and rollback are implemented on the core-api host. A real Docker daemon acceptance run is still required. The generated managed Actions workflow currently supports PM2; Docker deployments need an explicit CI request to the same deployment API.

Bind CARF_LOCAL_INSTALLATION_ID to the permitted installation. Use an existing Compose-managed container and image tags tied to the exact commit SHA. The adapter reads the Compose service label, writes a temporary image override, and recreates only that service with --no-build --no-deps. Compose retains ports, environment, volumes, and networks. Rollback restores the captured image ID. Containers without a Compose manifest are rejected for deployment instead of being recreated without their configuration.

Example `.carf.yml`:

```yaml
mode: standalone
deploymentIntegration: github_actions
runtimeAdapter: docker
adapter:
  kind: docker
  target: api-backend
  composeFile: /srv/api/compose.yml
  imageTag: ghcr.io/example/api:{sha}
  healthUrl: http://127.0.0.1:8080/health
  startupGraceSeconds: 30
```

Build and publish the SHA-tagged image before requesting deployment. The API requires a successful CI run for the exact default-branch revision. The saved deployedRevision is a runtime image identity and may differ from the Git commit SHA.

Reference artifacts: environments/docker. Contract tests inspect the actual generated override. To establish live support on your host, deploy v1, deploy v2, inject failure, restore the saved image, and verify published ports, health, volumes, and runtime image identity against a disposable Compose project.
