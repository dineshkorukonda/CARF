import { describe, expect, it, vi } from "vitest";
import { DockerAdapter } from "../../src/adapters/docker.js";

describe("DockerAdapter (Docker Runtime Adapter)", () => {
  it("detects availability when docker CLI is available", async () => {
    const mockExec = vi.fn().mockResolvedValue({ stdout: "Docker version 24.0.5, build ced0996\n", stderr: "" });
    const adapter = new DockerAdapter("carf-app:v1", { exec: mockExec });
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("discovers running containers", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: "carf-sample-docker-app\nredis-cache\npostgres-db\n",
      stderr: "",
    });
    const adapter = new DockerAdapter("carf-app:v1", { exec: mockExec });
    const discovered = await adapter.discover();
    expect(discovered).toEqual(["carf-sample-docker-app", "redis-cache", "postgres-db"]);
  });

  it("inspects container runtime status", async () => {
    const inspectOutput = [
      {
        State: {
          Status: "running",
          Running: true,
          Dead: false,
          ExitCode: 0,
          StartedAt: new Date(Date.now() - 30000).toISOString(),
        },
        RestartCount: 0,
        Config: {
          Image: "carf-sample-app:v2",
        },
      },
    ];

    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify(inspectOutput),
      stderr: "",
    });

    const adapter = new DockerAdapter("carf-sample-app:v1", { exec: mockExec });
    const status = await adapter.getStatus("carf-sample-docker-app");

    expect(status.status).toBe("online");
    expect(status.version).toBe("carf-sample-app:v2");
    expect(status.uptimeSeconds).toBeGreaterThanOrEqual(25);
  });

  it("reports healthy when container is running and HTTP probe returns 200", async () => {
    const inspectOutput = [
      {
        State: { Running: true, Dead: false, ExitCode: 0 },
        RestartCount: 0,
      },
    ];
    const mockExec = vi.fn().mockResolvedValue({ stdout: JSON.stringify(inspectOutput), stderr: "" });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const adapter = new DockerAdapter("carf-sample-app:v1", {
      exec: mockExec,
      healthUrl: "http://localhost:8080/health",
      fetchFn: mockFetch,
    });

    const health = await adapter.checkHealth();
    expect(health.healthy).toBe(true);
    expect(health.errorRate).toBe(0);
    expect(health.processErrorRate).toBe(0);
    expect(health.httpErrorRate).toBe(0);
  });

  it("detects failure when container restart count increases", async () => {
    let callCount = 0;
    const mockExec = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        stdout: JSON.stringify([
          {
            State: { Running: true, Dead: false, ExitCode: 0 },
            RestartCount: callCount === 1 ? 0 : 3, // Restart spike!
          },
        ]),
        stderr: "",
      };
    });

    const adapter = new DockerAdapter("carf-sample-app:v1", { exec: mockExec });
    const initialHealth = await adapter.checkHealth();
    expect(initialHealth.healthy).toBe(true);

    const postCrashHealth = await adapter.checkHealth();
    expect(postCrashHealth.healthy).toBe(false);
    expect(postCrashHealth.errorRate).toBe(1.0);
  });

  it("detects failure when HTTP health probe fails", async () => {
    const inspectOutput = [{ State: { Running: true, Dead: false, ExitCode: 0 }, RestartCount: 0 }];
    const mockExec = vi.fn().mockResolvedValue({ stdout: JSON.stringify(inspectOutput), stderr: "" });
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const adapter = new DockerAdapter("carf-sample-app:v1", {
      exec: mockExec,
      healthUrl: "http://localhost:8080/health",
      fetchFn: mockFetch,
    });

    const health = await adapter.checkHealth();
    expect(health.healthy).toBe(false);
    expect(health.httpErrorRate).toBe(1.0);
    expect(health.errorRate).toBe(1.0);
  });

  it("executes atomic rollback to previous image tag", async () => {
    const executedCommands: string[] = [];
    const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
      executedCommands.push(cmd);
      return { stdout: "", stderr: "" };
    });

    const adapter = new DockerAdapter("carf-sample-app:v1", {
      composeFile: "environments/docker/compose.yml",
      exec: mockExec,
    });

    await adapter.rollback();
    expect(executedCommands).toContain(
      "docker compose -f environments/docker/compose.yml up -d --force-recreate"
    );
  });

  it("verifies post-rollback health during rollbackWithVerification", async () => {
    let polled = 0;
    const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd.includes("inspect")) {
        polled++;
        return {
          stdout: JSON.stringify([
            {
              State: { Running: polled > 1 },
              RestartCount: 0,
            },
          ]),
          stderr: "",
        };
      }
      return { stdout: "", stderr: "" };
    });

    let fakeTime = 1000;
    const adapter = new DockerAdapter("carf-sample-app:v1", {
      exec: mockExec,
      sleep: async () => {
        fakeTime += 1000;
      },
      now: () => fakeTime,
      startupGraceSeconds: 10,
    });

    const verification = await adapter.rollbackWithVerification();
    expect(verification.rollbackVerified).toBe(true);
    expect(verification.errorRate).toBe(0);
  });
});
