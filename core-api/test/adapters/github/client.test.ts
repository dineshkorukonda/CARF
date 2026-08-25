import { afterEach, describe, expect, it, vi } from "vitest";

describe("adapters/github/client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("importing the module does not throw even without GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY set", async () => {
    vi.stubEnv("GITHUB_APP_ID", "");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
    await expect(import("../../../src/adapters/github/client.js")).resolves.toBeDefined();
  });

  it("exports a githubApiClient usable without any env vars set", async () => {
    vi.stubEnv("GITHUB_APP_ID", "");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
    const { githubApiClient } = await import("../../../src/adapters/github/client.js");
    expect(githubApiClient).toBeDefined();
    expect(typeof githubApiClient.compareCommits).toBe("function");
  });

  it("getInstallationTokenClient() throws when GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY are missing (lazy validation, only on call)", async () => {
    vi.stubEnv("GITHUB_APP_ID", "");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
    const { getInstallationTokenClient } = await import("../../../src/adapters/github/client.js");
    expect(() => getInstallationTokenClient()).toThrow(/GITHUB_APP_ID/);
  });

  it("getInstallationTokenClient() returns the same cached instance across calls when env vars are set", async () => {
    vi.stubEnv("GITHUB_APP_ID", "app-123");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "fake-key-not-parsed-until-signing");
    const { getInstallationTokenClient } = await import("../../../src/adapters/github/client.js");
    const first = getInstallationTokenClient();
    const second = getInstallationTokenClient();
    expect(first).toBe(second);
  });
});
