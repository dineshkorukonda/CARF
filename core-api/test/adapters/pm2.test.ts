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
    expect(result).toEqual({ errorRate: 0, healthy: true });
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

    expect(result).toEqual({ errorRate: 1, healthy: false });
  });
});

describe("PM2Adapter.rollback", () => {
  it("repoints the current symlink at the previous release and reloads the process", async () => {
    const exec = mockExec("");
    const adapter = new PM2Adapter("abc123", { exec });

    await adapter.rollback("web");

    expect(exec).toHaveBeenNthCalledWith(1, "ln -sfn /var/www/releases/abc123 /var/www/current");
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

    expect(exec).toHaveBeenNthCalledWith(1, "ln -sfn /srv/app/releases/abc123 /srv/app/current");
  });
});
