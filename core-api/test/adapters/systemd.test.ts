import { describe, expect, it, vi } from "vitest";
import { SystemdAdapter } from "../../src/adapters/systemd.js";

describe("SystemdAdapter (Linux systemd Runtime Adapter)", () => {
  it("detects availability when systemctl is present", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: "systemd 249 (249.11-0ubuntu3.9)\n+PAM +AUDIT +SELINUX\n",
      stderr: "",
    });
    const adapter = new SystemdAdapter("v1.0.0", { exec: mockExec });
    expect(await adapter.isAvailable()).toBe(true);
    expect(mockExec).toHaveBeenCalledWith("systemctl --version");
  });

  it("discovers running services", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: "app.service loaded active running My Web App\nnginx.service loaded active running Nginx Web Server\n",
      stderr: "",
    });
    const adapter = new SystemdAdapter("v1.0.0", { exec: mockExec });
    const discovered = await adapter.discover();
    expect(discovered).toEqual(["app.service", "nginx.service"]);
  });

  it("inspects unit status correctly", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: "ActiveState=active\nSubState=running\nMainPID=1452\nExecMainStatus=0\n",
      stderr: "",
    });
    const adapter = new SystemdAdapter("v1.0.0", { serviceName: "app.service", exec: mockExec });
    const status = await adapter.getStatus("app.service");
    expect(status.status).toBe("online");
    expect(status.connected).toBe(true);
    expect(status.instances).toBe(1);
    expect(status.metadata?.mainPid).toBe("1452");
  });

  it("reports healthy when unit is active and HTTP probe returns 200", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: "active\n",
      stderr: "",
    });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const adapter = new SystemdAdapter("v1.0.0", {
      serviceName: "app.service",
      healthUrl: "http://localhost:3000/health",
      exec: mockExec,
      fetchFn: mockFetch,
    });

    const health = await adapter.checkHealth("app.service");
    expect(health.healthy).toBe(true);
    expect(health.errorRate).toBe(0.0);
  });

  it("reports unhealthy when unit is inactive or failed", async () => {
    const mockExec = vi.fn().mockRejectedValue(new Error("Unit app.service is failed"));
    const adapter = new SystemdAdapter("v1.0.0", {
      serviceName: "app.service",
      exec: mockExec,
    });

    const health = await adapter.checkHealth("app.service");
    expect(health.healthy).toBe(false);
    expect(health.errorRate).toBe(1.0);
  });

  it("executes rollback and restarts service", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "",
    });
    const adapter = new SystemdAdapter("commit-abc-123", {
      serviceName: "app.service",
      workingDirectory: "/var/www/app",
      exec: mockExec,
    });

    await adapter.rollback("app.service");
    expect(mockExec).toHaveBeenCalledWith("git checkout commit-abc-123", { cwd: "/var/www/app" });
    expect(mockExec).toHaveBeenCalledWith("systemctl restart app.service");
  });

  it("reports healthy rollback as unverified without restoration identity", async () => {
    const mockExec = vi.fn().mockImplementation((cmd: string) => {
      if (cmd.includes("is-active")) {
        return Promise.resolve({ stdout: "active\n", stderr: "" });
      }
      return Promise.resolve({ stdout: "", stderr: "" });
    });
    const adapter = new SystemdAdapter("commit-abc-123", {
      serviceName: "app.service",
      exec: mockExec,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    const result = await adapter.rollbackWithVerification("app.service", 0);
    expect(result.rollbackVerified).toBe(false);
    expect(result.errorRate).toBe(0.0);
  });
});
