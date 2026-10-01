import { describe, expect, it, vi } from "vitest";
import { PM2Adapter } from "../../src/adapters/pm2.js";

function mockExec(stdout: string, stderr = "") {
  return vi.fn().mockResolvedValue({ stdout, stderr });
}

describe("PM2Adapter.checkHealth", () => {
  it("reports healthy with errorRate 0 when all matching processes are online", async () => {
    const exec = mockExec(
      JSON.stringify([
        { name: "web", pm2_env: { status: "online" } },
        { name: "web", pm2_env: { status: "online" } },
        { name: "other-app", pm2_env: { status: "errored" } },
      ])
    );
    const adapter = new PM2Adapter("abc123", { exec });

    const result = await adapter.checkHealth("web");

    expect(exec).toHaveBeenCalledWith("pm2 jlist");
    expect(result).toMatchObject({ errorRate: 0, healthy: true });
  });

  it("computes a fractional errorRate when some matching processes aren't online", async () => {
    const exec = mockExec(
      JSON.stringify([
        { name: "web", pm2_env: { status: "online" } },
        { name: "web", pm2_env: { status: "errored" } },
      ])
    );
    const adapter = new PM2Adapter("abc123", { exec });

    const result = await adapter.checkHealth("web");

    expect(result.errorRate).toBe(0.5);
    expect(result.healthy).toBe(false);
  });

  it("treats no matching process entries as fully unhealthy", async () => {
    const exec = mockExec(JSON.stringify([{ name: "other-app", pm2_env: { status: "online" } }]));
    const adapter = new PM2Adapter("abc123", { exec });

    const result = await adapter.checkHealth("web");

    expect(result).toMatchObject({ errorRate: 1, healthy: false });
  });

  it("evaluates multiple targets and returns max errorRate across targets", async () => {
    const exec = mockExec(
      JSON.stringify([
        { name: "web", pm2_env: { status: "online" } },
        { name: "worker", pm2_env: { status: "errored" } },
      ])
    );
    const adapter = new PM2Adapter("abc123", {
      exec,
      targets: ["web", "worker"],
    });

    // Check health without argument defaults to configured targets
    const result = await adapter.checkHealth();
    expect(result.errorRate).toBe(1); // worker is 100% unhealthy, so max is 1
    expect(result.healthy).toBe(false);

    // Comma-separated target argument
    const result2 = await adapter.checkHealth("web, worker");
    expect(result2.errorRate).toBe(1);
  });

  it("detects process restart count increase as unhealthy even if status is online", async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ pm_id: 0, name: "web", pm2_env: { status: "online", restart_time: 2 } }]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ pm_id: 0, name: "web", pm2_env: { status: "online", restart_time: 3 } }]),
        stderr: "",
      });

    const adapter = new PM2Adapter("abc123", { exec, target: "web" });

    // First check establishes baseline (restart_time = 2) -> healthy
    const first = await adapter.checkHealth();
    expect(first).toMatchObject({ errorRate: 0, healthy: true });

    // Second check observes restart_time increased to 3 -> unhealthy
    const second = await adapter.checkHealth();
    expect(second).toMatchObject({ errorRate: 1, healthy: false });
  });

  it("incorporates HTTP health probes and takes max of process and HTTP errorRate", async () => {
    const exec = mockExec(
      JSON.stringify([{ name: "web", pm2_env: { status: "online" } }])
    );
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      healthUrl: "http://localhost:3000/health",
      probeCount: 2,
      fetchFn,
    });

    const result = await adapter.checkHealth();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    // Process error rate is 0, HTTP error rate is 0.5 -> max is 0.5
    expect(result.errorRate).toBe(0.5);
    expect(result.healthy).toBe(false);
  });

  it("handles HTTP health probe fetch exceptions as probe failures", async () => {
    const exec = mockExec(
      JSON.stringify([{ name: "web", pm2_env: { status: "online" } }])
    );
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      healthUrl: "http://localhost:3000/health",
      probeCount: 1,
      fetchFn,
    });

    const result = await adapter.checkHealth();
    expect(result.errorRate).toBe(1);
    expect(result.healthy).toBe(false);
  });
});

describe("PM2Adapter.rollback", () => {
  it("verifies the previous release directory exists before repointing the symlink, then reloads the process (releases layout)", async () => {
    const exec = mockExec("");
    const adapter = new PM2Adapter("abc123", { exec });

    await adapter.rollback("web");

    expect(exec).toHaveBeenNthCalledWith(
      1,
      "test -d /var/www/releases/abc123 && ln -sfn /var/www/releases/abc123 /var/www/current"
    );
    expect(exec).toHaveBeenNthCalledWith(2, "pm2 reload web");
  });

  it("uses configured releasesRoot / currentSymlink when provided", async () => {
    const exec = mockExec("");
    const adapter = new PM2Adapter("abc123", {
      exec,
      releasesRoot: "/srv/app/releases",
      currentSymlink: "/srv/app/current",
    });

    await adapter.rollback("web");

    expect(exec).toHaveBeenNthCalledWith(
      1,
      "test -d /srv/app/releases/abc123 && ln -sfn /srv/app/releases/abc123 /srv/app/current"
    );
  });

  it("performs git checkout and buildCommand when layout is 'git'", async () => {
    const exec = mockExec("");
    const adapter = new PM2Adapter("abc123", {
      exec,
      layout: "git",
      cwd: "/var/www/app",
      buildCommand: "npm run build",
      targets: ["web", "worker"],
    });

    await adapter.rollback();

    expect(exec).toHaveBeenNthCalledWith(1, "cd /var/www/app && git checkout abc123");
    expect(exec).toHaveBeenNthCalledWith(2, "cd /var/www/app && npm run build");
    expect(exec).toHaveBeenNthCalledWith(3, "cd /var/www/app && pm2 reload web worker");
  });

  it("applyRelease fetches and checks out the new SHA then reloads (git layout)", async () => {
    const exec = mockExec("");
    const adapter = new PM2Adapter("abc123", {
      exec,
      layout: "git",
      cwd: "/opt/sahaay/my-app",
      target: "sahaay",
    });

    await adapter.applyRelease("def456", "sahaay");

    expect(exec).toHaveBeenNthCalledWith(1, "cd /opt/sahaay/my-app && git fetch origin");
    expect(exec).toHaveBeenNthCalledWith(2, "cd /opt/sahaay/my-app && git checkout def456");
    expect(exec).toHaveBeenNthCalledWith(3, "cd /opt/sahaay/my-app && pm2 reload sahaay");
  });

  it("propagates the failure (never reloads) when the previous release directory doesn't exist on this host", async () => {
    const exec = vi.fn().mockRejectedValue(new Error("Command failed: test -d ... exit code 1"));
    const adapter = new PM2Adapter("missing-sha", { exec });

    await expect(adapter.rollback("web")).rejects.toThrow();
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("accepts a custom CommandExecutor object", async () => {
    const mockExecutor = {
      exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
    };
    const adapter = new PM2Adapter("abc123", {
      exec: mockExecutor,
      target: "web",
    });

    await adapter.rollback();
    expect(mockExecutor.exec).toHaveBeenCalled();
  });
});

describe("PM2Adapter.rollbackWithVerification", () => {
  it("executes rollback and verifies post-rollback health", async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // test -d && ln -sfn
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // pm2 reload
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ name: "web", pm2_env: { status: "online" } }]),
        stderr: "",
      }); // pm2 jlist

    const adapter = new PM2Adapter("abc123", { exec, target: "web" });

    const result = await adapter.rollbackWithVerification();

    expect(result).toEqual({ verified: true, errorRate: 0, rollbackVerified: true });
    expect(exec).toHaveBeenCalledTimes(3);
  });

  it("waits through post-checkout launch for git layout instead of failing the first poll", async () => {
    let now = 0;
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git checkout
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // build
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // pm2 reload
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ name: "web", pm2_env: { status: "launching", restart_time: 4 } }]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ name: "web", pm2_env: { status: "online", restart_time: 4 } }]),
        stderr: "",
      });

    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      layout: "git",
      cwd: "/var/www/app",
      buildCommand: "npm run build",
      startupGraceSeconds: 5,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });

    const result = await adapter.rollbackWithVerification();

    expect(result).toEqual({ verified: true, errorRate: 0, rollbackVerified: true });
    expect(exec).toHaveBeenCalledWith("cd /var/www/app && git checkout abc123");
    expect(exec).toHaveBeenCalledWith("cd /var/www/app && npm run build");
    expect(exec).toHaveBeenCalledWith("cd /var/www/app && pm2 reload web");
  });

  it("does not treat the expected rollback reload as a verification failure after soak baselines exist", async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ name: "web", pm_id: 1, pm2_env: { status: "online", restart_time: 2 } }]),
        stderr: "",
      })
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git checkout
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // pm2 reload
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ name: "web", pm_id: 1, pm2_env: { status: "online", restart_time: 3 } }]),
        stderr: "",
      });

    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      layout: "git",
      cwd: "/var/www/app",
    });

    await expect(adapter.checkHealth()).resolves.toMatchObject({ healthy: true });
    const result = await adapter.rollbackWithVerification();

    expect(result).toEqual({ verified: true, errorRate: 0, rollbackVerified: true });
  });

  it("returns rollbackVerified false only after the grace window expires unhealthy", async () => {
    let now = 0;
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git checkout
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // pm2 reload
      .mockResolvedValue({
        stdout: JSON.stringify([{ name: "web", pm2_env: { status: "errored", restart_time: 8 } }]),
        stderr: "",
      });

    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      layout: "git",
      cwd: "/var/www/app",
      startupGraceSeconds: 2,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });

    const result = await adapter.rollbackWithVerification();

    expect(result.rollbackVerified).toBe(false);
    expect(result.verified).toBe(false);
    expect(exec.mock.calls.length).toBeGreaterThan(3);
  });
});
