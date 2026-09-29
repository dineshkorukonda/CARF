import { describe, expect, it } from "vitest";
import { reconcileGitLayoutVerify } from "../../src/lib/gitLayoutVerify";

const sahaayStale = {
  verified: false,
  checks: [
    { id: "pm2_daemon", title: "PM2", passed: true, message: "ok" },
    { id: "target_app", title: "Target", passed: true, message: "ok" },
    { id: "health_url", title: "Health", passed: true, message: "ok" },
    { id: "releases_dir", title: "Releases", passed: false, message: "missing" },
    { id: "current_symlink", title: "Current", passed: false, message: "not a link" },
    { id: "shared_paths", title: "Shared", passed: true, message: "none" },
    { id: "rollback_permission", title: "Perms", passed: true, message: "ok" },
  ],
};

describe("reconcileGitLayoutVerify", () => {
  it("marks git layout verified when the only failures are Capistrano path checks", () => {
    const result = reconcileGitLayoutVerify(
      { name: "sahaay", layout: "git", cwd: "/opt/sahaay/my-app" },
      sahaayStale
    );
    expect(result.verified).toBe(true);
    expect(result.staleCoreApi).toBe(true);
    expect(result.layout).toBe("git");
    expect(result.checks.find((c) => c.id === "releases_dir")?.passed).toBe(true);
    expect(result.checks.find((c) => c.id === "current_symlink")?.passed).toBe(true);
  });

  it("leaves releases layout failures in place", () => {
    const result = reconcileGitLayoutVerify(
      { name: "app", layout: "releases", currentSymlink: "/var/www/current" },
      sahaayStale
    );
    expect(result.verified).toBe(false);
    expect(result.checks.find((c) => c.id === "releases_dir")?.passed).toBe(false);
  });

  it("does not rewrite when core-api already returned git checks", () => {
    const result = reconcileGitLayoutVerify(
      { name: "sahaay", layout: "git", cwd: "/opt/sahaay/my-app" },
      {
        verified: true,
        layout: "git",
        checks: [
          { id: "working_directory", title: "cwd", passed: true, message: "ok" },
          { id: "git_metadata", title: "git", passed: true, message: "ok" },
        ],
      }
    );
    expect(result.verified).toBe(true);
    expect(result.staleCoreApi).toBe(false);
  });

  it("marks git layout verified when the only failure is missing .git", () => {
    const result = reconcileGitLayoutVerify(
      { name: "sahaay", layout: "git", cwd: "/opt/sahaay/my-app" },
      {
        verified: false,
        layout: "git",
        checks: [
          { id: "pm2_daemon", title: "PM2", passed: true, message: "ok" },
          { id: "target_app", title: "Target", passed: true, message: "ok" },
          { id: "health_url", title: "Health", passed: true, message: "ok" },
          { id: "working_directory", title: "cwd", passed: true, message: "ok" },
          { id: "git_metadata", title: "git", passed: false, message: "missing .git" },
          { id: "rollback_permission", title: "Perms", passed: true, message: "ok" },
        ],
      }
    );
    expect(result.verified).toBe(true);
    expect(result.checks.find((c) => c.id === "git_metadata")?.passed).toBe(true);
  });
});
