import { describe, expect, it, vi } from "vitest";
import { DockerComposeAdapter } from "../../src/adapters/dockerCompose.js";

function mockExec(stdout: string, stderr = "") {
  return vi.fn().mockResolvedValue({ stdout, stderr });
}

describe("DockerComposeAdapter.checkHealth", () => {
  it("reports healthy with errorRate 0 when all containers are running/healthy", async () => {
    const exec = mockExec(
      [
        JSON.stringify({ Name: "web-1", State: "running", Health: "healthy" }),
        JSON.stringify({ Name: "web-2", State: "running", Health: "healthy" }),
      ].join("\n")
    );
    const adapter = new DockerComposeAdapter("v1.0.0", { exec });

    const result = await adapter.checkHealth("web");

    expect(exec).toHaveBeenCalledWith("docker compose ps --format json web");
    expect(result).toEqual({ errorRate: 0, healthy: true });
  });

  it("computes a fractional errorRate when some containers are unhealthy or not running", async () => {
    const exec = mockExec(
      [
        JSON.stringify({ Name: "web-1", State: "running", Health: "healthy" }),
        JSON.stringify({ Name: "web-2", State: "exited", Health: "unhealthy" }),
      ].join("\n")
    );
    const adapter = new DockerComposeAdapter("v1.0.0", { exec });

    const result = await adapter.checkHealth("web");

    expect(result.errorRate).toBe(0.5);
    expect(result.healthy).toBe(false);
  });

  it("treats no reported containers as fully unhealthy", async () => {
    const exec = mockExec("");
    const adapter = new DockerComposeAdapter("v1.0.0", { exec });

    const result = await adapter.checkHealth("web");

    expect(result).toEqual({ errorRate: 1, healthy: false });
  });

  it("includes the configured compose file flag when provided", async () => {
    const exec = mockExec(JSON.stringify({ Name: "web-1", State: "running", Health: "healthy" }));
    const adapter = new DockerComposeAdapter("v1.0.0", { exec, composeFile: "docker-compose.prod.yml" });

    await adapter.checkHealth("web");

    expect(exec).toHaveBeenCalledWith("docker compose -f docker-compose.prod.yml ps --format json web");
  });
});

describe("DockerComposeAdapter.rollback", () => {
  it("redeploys the previous image tag via docker compose up -d", async () => {
    const exec = mockExec("");
    const adapter = new DockerComposeAdapter("v0.9.0", { exec });

    await adapter.rollback("web");

    expect(exec).toHaveBeenCalledWith("IMAGE_TAG=v0.9.0 docker compose up -d web");
  });

  it("includes the configured compose file flag on rollback too", async () => {
    const exec = mockExec("");
    const adapter = new DockerComposeAdapter("v0.9.0", { exec, composeFile: "docker-compose.prod.yml" });

    await adapter.rollback("web");

    expect(exec).toHaveBeenCalledWith("IMAGE_TAG=v0.9.0 docker compose -f docker-compose.prod.yml up -d web");
  });
});
