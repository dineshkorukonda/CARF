import { describe, expect, it } from "vitest";
import { authConfig } from "../../src/auth.config";

describe("session middleware boundaries", () => {
  const authorize = (pathname: string) => authConfig.callbacks!.authorized!({
    auth: null, request: { nextUrl: { pathname } },
  } as never);
  it.each(["/api/agent/config", "/api/agent/heartbeat", "/api/agent/rollout-outcome",
    "/api/agent/uninstall", "/api/agent/version", "/install.sh", "/agent/agent.mjs", "/api/health"])(
    "allows machine authentication or public assets at %s", async (path) => {
      expect(await authorize(path)).toBe(true);
    });
  it.each(["/dashboard", "/api/repo/link", "/api/agent-admin", "/agent/private.mjs"])(
    "requires a session at %s", async (path) => {
      expect(await authorize(path)).toBe(false);
    });
});
