import { describe, expect, it, vi } from "vitest";
import { DockerSwarmAdapter } from "../../src/adapters/dockerSwarm.js";

function mockExec(stdout: string, stderr = "") {
  return vi.fn().mockResolvedValue({ stdout, stderr });
}

describe("DockerSwarmAdapter.checkHealth", () => {
  it("reports healthy with errorRate 0 when all desired tasks are running", async () => {
    const exec = mockExec(
      [
        JSON.stringify({ ID: "t1", CurrentState: "Running 5 minutes ago", DesiredState: "Running" }),
        JSON.stringify({ ID: "t2", CurrentState: "Running 5 minutes ago", DesiredState: "Running" }),
      ].join("\n")
    );
    const adapter = new DockerSwarmAdapter({ exec });

    const result = await adapter.checkHealth("web");

    expect(exec).toHaveBeenCalledWith("docker service ps web --filter desired-state=running --format json");
    expect(result).toEqual({ errorRate: 0, healthy: true });
  });

  it("computes a fractional errorRate when some tasks aren't running", async () => {
    const exec = mockExec(
      [
        JSON.stringify({ ID: "t1", CurrentState: "Running 5 minutes ago", DesiredState: "Running" }),
        JSON.stringify({ ID: "t2", CurrentState: "Failed 1 minute ago", DesiredState: "Running" }),
      ].join("\n")
    );
    const adapter = new DockerSwarmAdapter({ exec });

    const result = await adapter.checkHealth("web");

    expect(result.errorRate).toBe(0.5);
    expect(result.healthy).toBe(false);
  });

  it("treats no reported tasks as fully unhealthy", async () => {
    const exec = mockExec("");
    const adapter = new DockerSwarmAdapter({ exec });

    const result = await adapter.checkHealth("web");

    expect(result).toEqual({ errorRate: 1, healthy: false });
  });
});

describe("DockerSwarmAdapter.rollback", () => {
  it("runs docker service update --rollback for the target service", async () => {
    const exec = mockExec("");
    const adapter = new DockerSwarmAdapter({ exec });

    await adapter.rollback("web");

    expect(exec).toHaveBeenCalledWith("docker service update --rollback web");
  });
});
