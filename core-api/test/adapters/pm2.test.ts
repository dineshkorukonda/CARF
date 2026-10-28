import { describe, expect, it, vi } from "vitest";
import { PM2Adapter } from "../../src/adapters/pm2.js";

describe("PM2 deployed revision", () => {
  it("rolls back to the captured deployed revision rather than an undeployed Git parent", async () => {
    const live = "a".repeat(40);
    const exec = vi.fn(async (command: string) => ({ stdout: command.includes("rev-parse") ? live : "", stderr: "" }));
    const adapter = new PM2Adapter("b".repeat(40), { exec, layout: "git", cwd: "/opt/app", target: "app", buildCommand: "npm ci && npm run build" });
    expect(await adapter.getCurrentRevision()).toBe(live);
    await adapter.applyRelease("c".repeat(40));
    await adapter.rollback();
    expect(exec).toHaveBeenCalledWith(`cd /opt/app && git checkout ${live}`);
    expect(exec.mock.calls.filter(([cmd]) => cmd.includes("npm ci")).length).toBe(2);
  });
  it("refuses an unidentifiable rollback baseline", async () => {
    const adapter = new PM2Adapter("parent", { exec: async () => ({ stdout: "unknown", stderr: "" }), layout: "git" });
    await expect(adapter.getCurrentRevision()).rejects.toThrow("deployment skipped");
  });
});

describe("PM2Adapter.checkHealth", () => {
  it("reports healthy with errorRate 0 when all matching processes are online", async () => {
    const exec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([
        { name: "web", pm2_env: { status: "online", restart_time: 0 } },
        { name: "worker", pm2_env: { status: "online", restart_time: 0 } },
      ]),
      stderr: "",
    });

    const adapter = new PM2Adapter("abc123", { exec, target: "web" });
    const result = await adapter.checkHealth();

    expect(result).toEqual({
      errorRate: 0,
      healthy: true,
      processErrorRate: 0,
      httpErrorRate: 0,
    });
    expect(exec).toHaveBeenCalledWith("pm2 jlist");
  });

  it("computes a fractional errorRate when some matching processes aren't online", async () => {
    const exec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([
        { name: "web", pm2_env: { status: "online", restart_time: 0 } },
        { name: "web", pm2_env: { status: "stopped", restart_time: 0 } },
      ]),
      stderr: "",
    });

    const adapter = new PM2Adapter("abc123", { exec, target: "web" });
    const result = await adapter.checkHealth();

    expect(result.errorRate).toBe(0.5);
    expect(result.healthy).toBe(false);
  });

  it("treats no matching process entries as fully unhealthy", async () => {
    const exec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([{ name: "other-app", pm2_env: { status: "online" } }]),
      stderr: "",
    });

    const adapter = new PM2Adapter("abc123", { exec, target: "web" });
    const result = await adapter.checkHealth();

    expect(result.errorRate).toBe(1);
    expect(result.healthy).toBe(false);
  });

  it("evaluates multiple targets and returns max errorRate across targets", async () => {
    const exec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([
        { name: "web", pm2_env: { status: "online", restart_time: 0 } },
        { name: "worker", pm2_env: { status: "errored", restart_time: 0 } },
      ]),
      stderr: "",
    });

    const adapter = new PM2Adapter("abc123", {
      exec,
      targets: ["web", "worker"],
    });

    const result = await adapter.checkHealth();

    expect(result.processErrorRate).toBe(1);
    expect(result.healthy).toBe(false);
  });

  it("detects process restart count increase as unhealthy even if status is online", async () => {
    let callCount = 0;
    const exec = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        stdout: JSON.stringify([
          {
            name: "web",
            pm_id: 1,
            pm2_env: {
              status: "online",
              restart_time: callCount === 1 ? 2 : 3, // Restart count increased
            },
          },
        ]),
        stderr: "",
      };
    });

    const adapter = new PM2Adapter("abc123", { exec, target: "web" });

    // Initial baseline check
    const res1 = await adapter.checkHealth();
    expect(res1.healthy).toBe(true);

    // Subsequent check where restart_time incremented
    const res2 = await adapter.checkHealth();
    expect(res2.healthy).toBe(false);
    expect(res2.errorRate).toBe(1);
  });

  it("incorporates HTTP health probes and takes max of process and HTTP errorRate", async () => {
    const exec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([
        { name: "web", pm2_env: { status: "online", restart_time: 0 } },
      ]),
      stderr: "",
    });

    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      healthUrl: "http://localhost:3000/health",
      probeCount: 2,
      fetchFn,
    });

    const result = await adapter.checkHealth();

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.processErrorRate).toBe(0);
    expect(result.httpErrorRate).toBe(1);
    expect(result.errorRate).toBe(1);
    expect(result.healthy).toBe(false);
  });

  it("handles HTTP health probe fetch exceptions as probe failures", async () => {
    const exec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([
        { name: "web", pm2_env: { status: "online", restart_time: 0 } },
      ]),
      stderr: "",
    });

    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      healthUrl: "http://localhost:3000/health",
      fetchFn,
    });

    const result = await adapter.checkHealth();
    expect(result.httpErrorRate).toBe(1);
    expect(result.healthy).toBe(false);
  });
});

describe("PM2Adapter.rollback", () => {
  it("verifies the previous release directory exists before repointing the symlink, then reloads the process (releases layout)", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const adapter = new PM2Adapter("abc123", { exec, target: "web" });

    await adapter.rollback();

    expect(exec).toHaveBeenNthCalledWith(
      1,
      "test -d /var/www/releases/abc123 && ln -sfn /var/www/releases/abc123 /var/www/current"
    );
    expect(exec).toHaveBeenNthCalledWith(2, "pm2 reload web");
  });

  it("uses configured releasesRoot / currentSymlink when provided", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      releasesRoot: "/srv/app/releases",
      currentSymlink: "/srv/app/current",
    });

    await adapter.rollback();

    expect(exec).toHaveBeenNthCalledWith(
      1,
      "test -d /srv/app/releases/abc123 && ln -sfn /srv/app/releases/abc123 /srv/app/current"
    );
  });

  it("performs git checkout and buildCommand when layout is 'git'", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      layout: "git",
      cwd: "/var/www/app",
      buildCommand: "npm run build",
    });

    await adapter.rollback();

    expect(exec).toHaveBeenNthCalledWith(1, "cd /var/www/app && git checkout abc123");
    expect(exec).toHaveBeenNthCalledWith(2, "cd /var/www/app && npm run build");
    expect(exec).toHaveBeenNthCalledWith(3, "cd /var/www/app && pm2 reload web");
  });

  it("applyRelease fetches and checks out the new SHA then reloads (git layout)", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      layout: "git",
      cwd: "/var/www/app",
      buildCommand: "npm run build",
    });

    await adapter.applyRelease("def456");

    expect(exec).toHaveBeenNthCalledWith(1, "cd /var/www/app && git fetch origin");
    expect(exec).toHaveBeenNthCalledWith(2, "cd /var/www/app && git checkout def456");
    expect(exec).toHaveBeenNthCalledWith(3, "cd /var/www/app && npm run build");
    expect(exec).toHaveBeenNthCalledWith(4, "cd /var/www/app && pm2 reload web");
  });

  it("propagates the failure (never reloads) when the previous release directory doesn't exist on this host", async () => {
    const exec = vi
      .fn()
      .mockRejectedValueOnce(new Error("Command failed: test -d /var/www/releases/missing-sha && ..."));
    const adapter = new PM2Adapter("missing-sha", { exec, target: "web" });

    await expect(adapter.rollback()).rejects.toThrow(/test -d/);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).not.toHaveBeenCalledWith(expect.stringContaining("pm2 reload"));
  });

  it("accepts a custom CommandExecutor object", async () => {
    const customExecutor = {
      exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
    };

    const adapter = new PM2Adapter("abc123", {
      exec: customExecutor,
      target: "web",
    });

    await adapter.rollback();
    expect(customExecutor.exec).toHaveBeenCalledWith(expect.stringContaining("pm2 reload web"));
  });
});

describe("PM2Adapter.rollbackWithVerification", () => {
  it("executes rollback and verifies post-rollback health", async () => {
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // rollback test/ln
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // rollback pm2 reload
      .mockResolvedValue({
        stdout: JSON.stringify([{ name: "web", pm2_env: { status: "online", restart_time: 0 } }]),
        stderr: "",
      });

    const adapter = new PM2Adapter("abc123", { exec, target: "web" });
    vi.spyOn(adapter, "getCurrentRevision").mockResolvedValue("abc123");
    const result = await adapter.rollbackWithVerification();

    expect(result).toEqual({
      verified: true,
      errorRate: 0,
      rollbackVerified: true,
    });
  });

  it("waits through post-checkout launch for git layout instead of failing the first poll", async () => {
    let now = 0;
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // git checkout
      .mockResolvedValueOnce({ stdout: "", stderr: "" }) // pm2 reload
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ name: "web", pm2_env: { status: "launching", restart_time: 0 } }]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify([{ name: "web", pm2_env: { status: "online", restart_time: 0 } }]),
        stderr: "",
      });

    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      layout: "git",
      cwd: "/var/www/app",
      startupGraceSeconds: 30,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });

    vi.spyOn(adapter, "getCurrentRevision").mockResolvedValue("abc123");
    const result = await adapter.rollbackWithVerification();

    expect(result).toEqual({ verified: true, errorRate: 0, rollbackVerified: true });
    expect(now).toBe(1000);
  });

  it("does not treat the expected rollback reload as a verification failure after soak baselines exist", async () => {
    let restarts = 1;
    const exec = vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd.includes("pm2 reload")) {
        restarts++;
        return { stdout: "", stderr: "" };
      }
      return {
        stdout: JSON.stringify([{ name: "web", pm2_id: 1, pm2_env: { status: "online", restart_time: restarts } }]),
        stderr: "",
      };
    });

    const adapter = new PM2Adapter("abc123", {
      exec,
      target: "web",
      layout: "git",
      cwd: "/var/www/app",
    });

    await expect(adapter.checkHealth()).resolves.toMatchObject({ healthy: true });
    vi.spyOn(adapter, "getCurrentRevision").mockResolvedValue("abc123");
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

    vi.spyOn(adapter, "getCurrentRevision").mockResolvedValue("abc123");
    const result = await adapter.rollbackWithVerification();

    expect(result.rollbackVerified).toBe(false);
    expect(result.verified).toBe(false);
    expect(exec.mock.calls.length).toBeGreaterThan(3);
  });
});

describe("PM2Adapter discovery and process management", () => {
  it("discovers local PM2 processes cleanly and calculates uptime and metrics", async () => {
    const now = 1700000000000;
    const exec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([
        {
          name: "sahaay",
          pid: 982095,
          monit: { cpu: 0.5, memory: 104857600 },
          pm2_env: {
            status: "online",
            restart_time: 0,
            pm_uptime: now - 3600000, // 3600 seconds ago
            pm_cwd: "/opt/sahaay",
          },
        },
        {
          name: "daily",
          pid: 1234,
          monit: { cpu: 0.1, memory: 52428800 },
          pm2_env: {
            status: "online",
            restart_time: 1,
            pm_uptime: now - 1800000,
            pm_cwd: "/opt/daily",
          },
        },
      ]),
      stderr: "",
    });

    const adapter = new PM2Adapter("", { exec, now: () => now });
    const discovery = await adapter.discover();

    expect(discovery.connected).toBe(true);
    expect(discovery.runtime).toBe("pm2");
    expect(discovery.processes).toHaveLength(2);
    expect(discovery.processes[0]).toEqual({
      name: "sahaay",
      status: "online",
      pid: 982095,
      uptime: 3600,
      cpu: 0.5,
      memory: 104857600,
      restarts: 0,
      cwd: "/opt/sahaay",
    });

    const sahaayProc = await adapter.getProcess("sahaay");
    expect(sahaayProc).not.toBeNull();
    expect(sahaayProc?.name).toBe("sahaay");

    const missingProc = await adapter.getProcess("nonexistent");
    expect(missingProc).toBeNull();
  });

  it("handles PM2 daemon unavailable during discovery gracefully", async () => {
    const exec = vi.fn().mockRejectedValue(new Error("Command failed: pm2 jlist (not found)"));
    const adapter = new PM2Adapter("", { exec });

    const discovery = await adapter.discover();
    expect(discovery.connected).toBe(false);
    expect(discovery.runtime).toBe("pm2");
    expect(discovery.processes).toEqual([]);
    expect(discovery.error).toContain("pm2 jlist");
  });

  it("restarts and reloads named process safely", async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const adapter = new PM2Adapter("", { exec });

    await adapter.restart("sahaay");
    expect(exec).toHaveBeenCalledWith("pm2 restart sahaay");

    await adapter.reload("sahaay");
    expect(exec).toHaveBeenCalledWith("pm2 reload sahaay");
  });

  it("rejects invalid process names with shell characters", async () => {
    const exec = vi.fn();
    const adapter = new PM2Adapter("", { exec });

    await expect(adapter.restart("sahaay; rm -rf /")).rejects.toThrow(/contains illegal shell characters/);
    await expect(adapter.getProcess("app`id`")).rejects.toThrow(/contains illegal shell characters/);
  });

  it("falls back to lowercase process name if capitalized reload fails", async () => {
    const exec = vi
      .fn()
      .mockRejectedValueOnce(new Error("Process or Namespace Sahaay not found"))
      .mockResolvedValueOnce({ stdout: JSON.stringify([{ name: "sahaay" }]), stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });
    const adapter = new PM2Adapter("", { exec });

    await adapter.reload("Sahaay");
    expect(exec).toHaveBeenNthCalledWith(1, "pm2 reload Sahaay");
    expect(exec).toHaveBeenNthCalledWith(2, "pm2 jlist");
    expect(exec).toHaveBeenNthCalledWith(3, "pm2 reload sahaay");
  });

  it("checkHealth matches processes case-insensitively", async () => {
    const exec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify([{ name: "sahaay", pm2_env: { status: "online", restart_time: 0 } }]),
      stderr: "",
    });
    const adapter = new PM2Adapter("", { exec, target: "Sahaay" });

    const result = await adapter.checkHealth();
    expect(result.healthy).toBe(true);
    expect(result.processErrorRate).toBe(0);
  });
});

it.each(["different", "unavailable"])("does not verify healthy PM2 restoration with %s identity", async identity => {
  const adapter = new PM2Adapter("abc123", { target: "web", exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }) });
  vi.spyOn(adapter, "checkHealth").mockResolvedValue({ healthy: true, errorRate: 0, processErrorRate: 0, httpErrorRate: 0 });
  const revision = vi.spyOn(adapter, "getCurrentRevision");
  if (identity === "unavailable") revision.mockRejectedValue(new Error("unavailable"));
  else revision.mockResolvedValue(identity);
  expect((await adapter.rollbackWithVerification()).rollbackVerified).toBe(false);
});
